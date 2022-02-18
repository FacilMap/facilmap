import { promiseProps, stripObject } from "./utils/utils";
import { streamToArrayPromise } from "./utils/streams";
import { isInBbox } from "./utils/geo";
import { Server, Socket as SocketIO } from "socket.io";
import domain from "domain";
import { exportLineToGpx } from "./export/gpx";
import { find } from "./search";
import { geoipLookup } from "./geoip";
import { isEqual, omit } from "lodash";
import Database, { DatabaseEvents } from "./database/database";
import { Server as HttpServer } from "http";
import { Bbox, BboxWithZoom, EventHandler, EventName, MapEvents, MultipleEvents, PadData, PadId, RequestData, RequestName, ResponseData, Writable } from "facilmap-types";
import { calculateRoute, prepareForBoundingBox } from "./routing/routing";
import { RouteWithId } from "./database/route";

type SocketHandlers = {
	[requestName in RequestName]: RequestData<requestName> extends void ? () => any : (data: RequestData<requestName>) => ResponseData<requestName> | PromiseLike<ResponseData<requestName>>;
} & {
	error: (data: Error) => void;
	disconnect: () => void;
};

type DatabaseHandlers = {
	[eventName in EventName<DatabaseEvents>]?: EventHandler<DatabaseEvents, eventName>;
}

type MultipleEventPromises = {
	[eventName in keyof MultipleEvents<MapEvents>]: PromiseLike<MultipleEvents<MapEvents>[eventName]> | MultipleEvents<MapEvents>[eventName];
}

function isPadId(padId: PadId | true | undefined): padId is PadId {
	return !!(padId && padId !== true);
}

export default class Socket {
	constructor(server: HttpServer, database: Database) {
		const io = new Server(server, {
			cors: { origin: true },
			allowEIO3: true,
			maxHttpBufferSize: 100e6
		});

		io.sockets.on("connection", (socket: SocketIO) => {
			const d = domain.create();
			d.add(socket);

			d.on("error", function(err) {
				console.error("Uncaught error in socket:", err.stack);
				socket.disconnect();
			});

			new SocketConnection(socket, database);
		});
	}
}

class SocketConnection {
	socket: SocketIO;
	database: Database;
	padId: PadId | true | undefined = undefined;
	bbox: BboxWithZoom | undefined = undefined;
	writable: Writable | undefined = undefined;
	route: Omit<RouteWithId, "trackPoints"> | undefined = undefined;
	routes: Record<string, Omit<RouteWithId, "trackPoints">> = { };
	historyListener: undefined | (() => void) = undefined;
	pauseHistoryListener = 0;

	constructor(socket: SocketIO, database: Database) {
		this.socket = socket;
		this.database = database;

		this.registerSocketHandlers();
	}

	registerSocketHandlers() {
		for (const i of Object.keys(this.socketHandlers) as Array<keyof SocketHandlers>) {
			this.socket.on(i, async (data, callback) => {
				try {
					const res = await this.socketHandlers[i](data);

					if(!callback && res)
						console.trace("No callback available to send result of socket handler " + i);

					callback && callback(null, res);
				} catch (err) {
					console.log(err.stack);

					callback && callback({ message: err.message, stack: err.stack });
				}
			});
		}
	}

	registerDatabaseHandler<E extends EventName<DatabaseEvents>>(eventName: E, handler: EventHandler<DatabaseEvents, E>) {
		this.database.on(eventName, handler);

		return () => {
			this.database.off(eventName, handler);
		};
	}

	registerDatabaseHandlers() {
		for (const eventName of Object.keys(this.databaseHandlers) as Array<EventName<DatabaseEvents>>) {
			this.database.on(eventName as any, this.databaseHandlers[eventName] as any);
		}
	}

	unregisterDatabaseHandlers() {
		for (const eventName of Object.keys(this.databaseHandlers) as Array<EventName<DatabaseEvents>>) {
			this.database.removeListener(eventName as any, this.databaseHandlers[eventName] as any);
		}
	}

	getPadObjects(padData: PadData) {
		const promises: MultipleEventPromises = {
			padData: [ padData ],
			view: streamToArrayPromise(this.database.views.getViews(padData.id)),
			type: streamToArrayPromise(this.database.types.getTypes(padData.id)),
			line: streamToArrayPromise(this.database.lines.getPadLines(padData.id))
		};

		if(this.bbox) { // In case bbox is set while fetching pad data
			Object.assign(promises, {
				marker: streamToArrayPromise(this.database.markers.getPadMarkers(padData.id, this.bbox)),
				linePoints: streamToArrayPromise(this.database.lines.getLinePointsForPad(padData.id, this.bbox))
			});
		}

		return promiseProps(promises);
	}

	validateConditions(minimumPermissions: Writable, data?: any, structure?: object) {
		if(structure && !stripObject(data, structure))
			throw new Error("Invalid parameters.");

		if (minimumPermissions == Writable.ADMIN && ![Writable.ADMIN].includes(this.writable!))
			throw new Error('Only available in admin mode.');
		else if (minimumPermissions === Writable.WRITE && ![Writable.ADMIN, Writable.WRITE].includes(this.writable!))
			throw new Error('Only available in write mode.');
	}

	socketHandlers: SocketHandlers = {
		error: (err) => {
			console.error("Error! Disconnecting client.");
			console.error(err.stack);
			this.socket.disconnect();
		},

		setPadId: async (padId) => {
			if(typeof padId != "string")
				throw new Error("Invalid pad id");
			if(this.padId != null)
				throw new Error("Pad id already set");

			this.padId = true;

			const [admin, write, read] = await Promise.all([
				this.database.pads.getPadDataByAdminId(padId),
				this.database.pads.getPadDataByWriteId(padId),
				this.database.pads.getPadData(padId)
			]);

			let pad;
			if(admin)
				pad = { ...admin, writable: Writable.ADMIN };
			else if(write)
				pad = { ...write, writable: Writable.WRITE, adminId: undefined };
			else if(read)
				pad = { ...read, writable: Writable.READ, writeId: undefined, adminId: undefined };
			else {
				this.padId = undefined;
				throw new Error("This pad does not exist");
			}

			this.padId = pad.id;
			this.writable = pad.writable;

			this.registerDatabaseHandlers();

			return await this.getPadObjects(pad);
		},

		updateBbox: async (bbox) => {
			this.validateConditions(Writable.READ, bbox, {
				top: "number",
				left: "number",
				bottom: "number",
				right: "number",
				zoom: "number"
			});

			const bboxWithExcept: BboxWithZoom & { except?: Bbox } = { ...bbox };
			if(this.bbox && bbox.zoom == this.bbox.zoom)
				bboxWithExcept.except = this.bbox;

			this.bbox = bbox;

			const ret: MultipleEventPromises = {};

			if(this.padId && this.padId !== true) {
				ret.marker = streamToArrayPromise(this.database.markers.getPadMarkers(this.padId, bboxWithExcept));
				ret.linePoints = streamToArrayPromise(this.database.lines.getLinePointsForPad(this.padId, bboxWithExcept));
			}
			if(this.route)
				ret.routePoints = this.database.routes.getRoutePoints(this.route.id, bboxWithExcept, !bboxWithExcept.except).then((points) => ([points]));
			if(Object.keys(this.routes).length > 0) {
				ret.routePointsWithId = Promise.all(Object.keys(this.routes).map(
					(routeId) => this.database.routes.getRoutePoints(this.routes[routeId].id, bboxWithExcept, !bboxWithExcept.except).then((trackPoints) => ({ routeId, trackPoints }))
				));
			}

			return await promiseProps(ret);
		},

		disconnect: () => {
			if(this.padId)
				this.unregisterDatabaseHandlers();

			if (this.historyListener) {
				this.historyListener();
				this.historyListener = undefined;
			}

			if(this.route) {
				this.database.routes.deleteRoute(this.route.id).catch((err) => {
					console.error("Error clearing route", err.stack || err);
				});
			}

			for (const routeId of Object.keys(this.routes)) {
				this.database.routes.deleteRoute(this.routes[routeId].id).catch((err) => {
					console.error("Error clearing route", err.stack || err);
				});
			}
		},

		getPad: async (data) => {
			this.validateConditions(Writable.READ, data, {
				padId: "string"
			});

			const padData = await this.database.pads.getPadDataByAnyId(data.padId);
			return padData && {
				id: padData.id,
				name: padData.name,
				description: padData.description
			};
		},

		findPads: async (data) => {
			this.validateConditions(Writable.READ, data, {
				query: "string",
				start: "number",
				limit: "number"
			});

			return this.database.pads.findPads(data);
		},

		createPad: async (data) => {
			this.validateConditions(Writable.READ, data, {
				name: "string",
				defaultViewId: "number",
				id: "string",
				writeId: "string",
				adminId: "string",
				searchEngines: "boolean",
				description: "string",
				clusterMarkers: "boolean",
				legend1: "string",
				legend2: "string"
			});

			if(this.padId)
				throw new Error("Pad already loaded.");

			const padData = await this.database.pads.createPad(data);

			this.padId = padData.id;
			this.writable = Writable.ADMIN;

			this.registerDatabaseHandlers();

			return await this.getPadObjects(padData);
		},

		editPad: async (data) => {
			this.validateConditions(Writable.ADMIN, data, {
				name: "string",
				defaultViewId: "number",
				id: "string",
				writeId: "string",
				adminId: "string",
				searchEngines: "boolean",
				description: "string",
				clusterMarkers: "boolean",
				legend1: "string",
				legend2: "string"
			});

			if (!isPadId(this.padId))
				throw new Error("No map opened.");

			return await this.database.pads.updatePadData(this.padId, data);
		},

		deletePad: async () => {
			this.validateConditions(Writable.ADMIN);

			if (!isPadId(this.padId))
				throw new Error("No map opened.");

			await this.database.pads.deletePad(this.padId);
		},

		getMarker: async (data) => {
			this.validateConditions(Writable.READ, data, {
				id: "number"
			} );

			if (!isPadId(this.padId))
				throw new Error("No map opened.");

			return await this.database.markers.getMarker(this.padId, data.id);
		},

		addMarker: async (data) => {
			this.validateConditions(Writable.WRITE, data, {
				lat: "number",
				lon: "number",
				name: "string",
				colour: "string",
				size: "number",
				symbol: "string",
				shape: "string",
				typeId: "number",
				data: Object
			});

			if (!isPadId(this.padId))
				throw new Error("No map opened.");

			return await this.database.markers.createMarker(this.padId, data);
		},

		editMarker: async (data) => {
			this.validateConditions(Writable.WRITE, data, {
				id: "number",
				lat: "number",
				lon: "number",
				name: "string",
				colour: "string",
				size: "number",
				symbol: "string",
				shape: "string",
				typeId: "number",
				data: Object
			});

			if (!isPadId(this.padId))
				throw new Error("No map opened.");

			return this.database.markers.updateMarker(this.padId, data.id, data);
		},

		deleteMarker: async (data) => {
			this.validateConditions(Writable.WRITE, data, {
				id: "number"
			});

			if (!isPadId(this.padId))
				throw new Error("No map opened.");

			return this.database.markers.deleteMarker(this.padId, data.id);
		},

		getLineTemplate: async (data) => {
			this.validateConditions(Writable.WRITE, data, {
				typeId: "number"
			}); // || data.typeId == null)

			if (!isPadId(this.padId))
				throw new Error("No map opened.");

			return await this.database.lines.getLineTemplate(this.padId, data);
		},

		addLine: async (data) => {
			this.validateConditions(Writable.WRITE, data, {
				routePoints: [ { lat: "number", lon: "number" } ],
				trackPoints: [ { lat: "number", lon: "number" } ],
				mode: "string",
				colour: "string",
				width: "number",
				name: "string",
				typeId: "number",
				data: Object
			});

			if (!isPadId(this.padId))
				throw new Error("No map opened.");

			let fromRoute;
			if (data.mode != "track") {
				for (const route of [...(this.route ? [this.route] : []), ...Object.values(this.routes)]) {
					if(isEqual(route.routePoints, data.routePoints) && data.mode == route.mode) {
						fromRoute = { ...route, trackPoints: await this.database.routes.getAllRoutePoints(route.id) };
						break;
					}
				}
			}

			return await this.database.lines.createLine(this.padId, data, fromRoute);
		},

		editLine: async (data) => {
			this.validateConditions(Writable.WRITE, data, {
				id: "number",
				routePoints: [ { lat: "number", lon: "number" } ],
				trackPoints: [ { lat: "number", lon: "number" } ],
				mode: "string",
				colour: "string",
				width: "number",
				name: "string",
				typeId: "number",
				data: Object
			});

			if (!isPadId(this.padId))
				throw new Error("No map opened.");

			let fromRoute;
			if (data.mode != "track") {
				for (const route of [...(this.route ? [this.route] : []), ...Object.values(this.routes)]) {
					if(isEqual(route.routePoints, data.routePoints) && data.mode == route.mode) {
						fromRoute = { ...route, trackPoints: await this.database.routes.getAllRoutePoints(route.id) };
						break;
					}
				}
			}

			return await this.database.lines.updateLine(this.padId, data.id, data, undefined, fromRoute);
		},

		deleteLine: async (data) => {
			this.validateConditions(Writable.WRITE, data, {
				id: "number"
			});

			if (!isPadId(this.padId))
				throw new Error("No map opened.");

			return this.database.lines.deleteLine(this.padId, data.id);
		},

		exportLine: async (data) => {
			this.validateConditions(Writable.READ, data, {
				id: "string",
				format: "string"
			});

			if (!isPadId(this.padId))
				throw new Error("No map opened.");

			const lineP = this.database.lines.getLine(this.padId, data.id);
			lineP.catch(() => null); // Avoid unhandled promise error (https://stackoverflow.com/a/59062117/242365)

			const [line, trackPoints, type] = await Promise.all([
				lineP,
				this.database.lines.getAllLinePoints(data.id),
				lineP.then((line) => this.database.types.getType(this.padId as string, line.typeId))
			]);

			const lineWithTrackPoints = { ...line, trackPoints };

			switch(data.format) {
				case "gpx-trk":
					return exportLineToGpx(lineWithTrackPoints, type, true);
				case "gpx-rte":
					return exportLineToGpx(lineWithTrackPoints, type, false);
				default:
					throw new Error("Unknown format.");
			}
		},

		addView: async (data) => {
			this.validateConditions(Writable.ADMIN, data, {
				name: "string",
				baseLayer: "string",
				layers: [ "string" ],
				top: "number",
				left: "number",
				right: "number",
				bottom: "number",
				filter: "string"
			});

			if (!isPadId(this.padId))
				throw new Error("No map opened.");

			return await this.database.views.createView(this.padId, data);
		},

		editView: async (data) => {
			this.validateConditions(Writable.ADMIN, data, {
				id: "number",
				baseLayer: "string",
				layers: [ "string" ],
				top: "number",
				left: "number",
				right: "number",
				bottom: "number",
				filter: "string"
			});

			if (!isPadId(this.padId))
				throw new Error("No map opened.");

			return await this.database.views.updateView(this.padId, data.id, data);
		},

		deleteView: async (data) => {
			this.validateConditions(Writable.ADMIN, data, {
				id: "number"
			});

			if (!isPadId(this.padId))
				throw new Error("No map opened.");

			return await this.database.views.deleteView(this.padId, data.id);
		},

		addType: async (data) => {
			this.validateConditions(Writable.ADMIN, data, {
				id: "number",
				name: "string",
				type: "string",
				defaultColour: "string", colourFixed: "boolean",
				defaultSize: "number", sizeFixed: "boolean",
				defaultSymbol: "string", symbolFixed: "boolean",
				defaultShape: "string", shapeFixed: "boolean",
				defaultWidth: "number", widthFixed: "boolean",
				defaultMode: "string", modeFixed: "boolean",
				showInLegend: "boolean",
				fields: [ {
					name: "string",
					type: "string",
					default: "string",
					controlColour: "boolean", controlSize: "boolean", controlSymbol: "boolean", controlShape: "boolean", controlWidth: "boolean",
					options: [ { key: "string", value: "string", colour: "string", size: "number", "symbol": "string", shape: "string", width: "number" } ]
				}]
			});

			if (!isPadId(this.padId))
				throw new Error("No map opened.");

			return await this.database.types.createType(this.padId, data);
		},

		editType: async (data) => {
			this.validateConditions(Writable.ADMIN, data, {
				id: "number",
				name: "string",
				defaultColour: "string", colourFixed: "boolean",
				defaultSize: "number", sizeFixed: "boolean",
				defaultSymbol: "string", symbolFixed: "boolean",
				defaultShape: "string", shapeFixed: "boolean",
				defaultWidth: "number", widthFixed: "boolean",
				defaultMode: "string", modeFixed: "boolean",
				showInLegend: "boolean",
				fields: [ {
					name: "string",
					oldName: "string",
					type: "string",
					default: "string",
					controlColour: "boolean", controlSize: "boolean", controlSymbol: "boolean", controlShape: "boolean", controlWidth: "boolean",
					options: [ { key: "string", value: "string", oldValue: "string", colour: "string", size: "number", "symbol": "string", shape: "string", width: "number" } ]
				}]
			});

			if (!isPadId(this.padId))
				throw new Error("No map opened.");

			const rename: Record<string, { name?: string, values?: Record<string, string> }> = {};
			for(const field of (data.fields || [])) {
				if(field.oldName && field.oldName != field.name)
					rename[field.oldName] = { name: field.name };

				if(field.options) {
					for(const option of field.options) {
						if(option.oldValue && option.oldValue != option.value) {
							if(!rename[field.oldName || field.name])
								rename[field.oldName || field.name] = { };
							if(!rename[field.oldName || field.name].values)
								rename[field.oldName || field.name].values = { };

							rename[field.oldName || field.name].values![option.oldValue] = option.value;
						}

						delete option.oldValue;
					}
				}

				delete field.oldName;
			}

			// We first update the type (without updating the styles). If that succeeds, we rename the data fields.
			// Only then we update the object styles (as they often depend on the field values).
			const newType = await this.database.types.updateType(this.padId, data.id, data, false)

			if(Object.keys(rename).length > 0)
				await this.database.helpers.renameObjectDataField(this.padId, data.id, rename, newType.type == "line");

			await this.database.types.recalculateObjectStylesForType(newType.padId, newType.id, newType.type == "line")

			return newType;
		},

		deleteType: async (data) => {
			this.validateConditions(Writable.ADMIN, data, {
				id: "number"
			});

			if (!isPadId(this.padId))
				throw new Error("No map opened.");

			return await this.database.types.deleteType(this.padId, data.id);
		},

		find: async (data) => {
			this.validateConditions(Writable.READ, data, {
				query: "string",
				loadUrls: "boolean",
				elevation: "boolean"
			});

			return await find(data.query, data.loadUrls, data.elevation);
		},

		findOnMap: async (data) => {
			this.validateConditions(Writable.READ, data, {
				query: "string"
			});

			if (!isPadId(this.padId))
				throw new Error("No map opened.");

			return await this.database.search.search(this.padId, data.query);
		},

		getRoute: async (data) => {
			this.validateConditions(Writable.READ, data, {
				destinations: [ { lat: "number", lon: "number" } ],
				mode: "string"
			});

			return await calculateRoute(data.destinations, data.mode);
		},

		setRoute: async (data) => {
			this.validateConditions(Writable.READ, data, { routePoints: [ { lat: "number", lon: "number" } ], mode: "string", routeId: "string" });

			const existingRoute = data.routeId ? this.routes[data.routeId] : this.route;

			let routeInfo;
			if(existingRoute)
				routeInfo = await this.database.routes.updateRoute(existingRoute.id, data.routePoints, data.mode);
			else
				routeInfo = await this.database.routes.createRoute(data.routePoints, data.mode);

			if(!routeInfo) {
				// A newer submitted route has returned in the meantime
				console.log("Ignoring outdated route");
				return;
			}

			if (data.routeId)
				this.routes[data.routeId] = omit(routeInfo, "trackPoints");
			else
				this.route = omit(routeInfo, "trackPoints");

			if(this.bbox)
				routeInfo.trackPoints = prepareForBoundingBox(routeInfo.trackPoints, this.bbox, true);
			else
				routeInfo.trackPoints = [];

			return {
				routeId: data.routeId,
				top: routeInfo.top,
				left: routeInfo.left,
				bottom: routeInfo.bottom,
				right: routeInfo.right,
				routePoints: routeInfo.routePoints,
				mode: routeInfo.mode,
				time: routeInfo.time,
				distance: routeInfo.distance,
				ascent: routeInfo.ascent,
				descent: routeInfo.descent,
				extraInfo: routeInfo.extraInfo,
				trackPoints: routeInfo.trackPoints
			};
		},

		clearRoute: async (data) => {
			if (data) {
				this.validateConditions(Writable.READ, data, {
					routeId: "string"
				});
			}

			let route;
			if (data?.routeId != null) {
				route = this.routes[data.routeId];
				delete this.routes[data.routeId];
			} else {
				route = this.route;
				this.route = undefined;
			}

			if (route)
				await this.database.routes.deleteRoute(route.id);
		},

		lineToRoute: async (data) => {
			this.validateConditions(Writable.READ, data, {
				id: "number",
				routeId: "string"
			});

			if (!isPadId(this.padId))
				throw new Error("No map opened.");

			const existingRoute = data.routeId ? this.routes[data.routeId] : this.route;
			const routeInfo = await this.database.routes.lineToRoute(existingRoute?.id, this.padId, data.id);

			if (!routeInfo) {
				// A newer submitted route has returned in the meantime
				console.log("Ignoring outdated route");
				return;
			}

			if (data.routeId)
				this.routes[routeInfo.id] = omit(routeInfo, "trackPoints");
			else
				this.route = omit(routeInfo, "trackPoints");

			if(this.bbox)
				routeInfo.trackPoints = prepareForBoundingBox(routeInfo.trackPoints, this.bbox, true);
			else
				routeInfo.trackPoints = [];

			return {
				routeId: data.routeId,
				top: routeInfo.top,
				left: routeInfo.left,
				bottom: routeInfo.bottom,
				right: routeInfo.right,
				routePoints: routeInfo.routePoints,
				mode: routeInfo.mode,
				time: routeInfo.time,
				distance: routeInfo.distance,
				ascent: routeInfo.ascent,
				descent: routeInfo.descent,
				trackPoints: routeInfo.trackPoints
			};
		},

		exportRoute: async (data) => {
			this.validateConditions(Writable.READ, data, {
				format: "string",
				routeId: "string"
			});

			const route = data.routeId ? this.routes[data.routeId] : this.route;
			if (!route) {
				throw new Error("Route not available.");
			}

			const trackPoints = await this.database.routes.getAllRoutePoints(route.id);

			const routeInfo = { ...this.route, trackPoints };

			switch(data.format) {
				case "gpx-trk":
					return await exportLineToGpx(routeInfo, undefined, true);
				case "gpx-rte":
					return await exportLineToGpx(routeInfo, undefined, false);
				default:
					throw new Error("Unknown format.");
			}
		},

		listenToHistory: async () => {
			this.validateConditions(Writable.WRITE);

			if (!isPadId(this.padId))
				throw new Error("No map opened.");

			if(this.historyListener)
				throw new Error("Already listening to history.");

			this.historyListener = this.registerDatabaseHandler("addHistoryEntry", (padId, data) => {
				if(padId == this.padId && (this.writable == Writable.ADMIN || ["Marker", "Line"].includes(data.type)) && !this.pauseHistoryListener)
					this.socket.emit("history", data);
			});

			return promiseProps({
				history: streamToArrayPromise(this.database.history.getHistory(this.padId, this.writable == Writable.ADMIN ? undefined : ["Marker", "Line"]))
			});
		},

		stopListeningToHistory: () => {
			this.validateConditions(Writable.WRITE);

			if(!this.historyListener)
				throw new Error("Not listening to history.");

			this.historyListener(); // Unregister db listener
			this.historyListener = undefined;
		},

		revertHistoryEntry: async (data) => {
			this.validateConditions(Writable.WRITE, data, {
				id: "number"
			});

			if (!isPadId(this.padId))
				throw new Error("No map opened.");

			const historyEntry = await this.database.history.getHistoryEntry(this.padId, data.id);

			if(!["Marker", "Line"].includes(historyEntry.type) && this.writable != Writable.ADMIN)
				throw new Error("This kind of change can only be reverted in admin mode.");

			this.pauseHistoryListener++;

			try {
				await this.database.history.revertHistoryEntry(this.padId, data.id);
			} finally {
				this.pauseHistoryListener--;
			}

			return promiseProps({
				history: streamToArrayPromise(this.database.history.getHistory(this.padId, this.writable == Writable.ADMIN ? undefined : ["Marker", "Line"]))
			});
		},

		geoip: async () => {
			const ip = (this.socket.handshake.headers as Record<string, string>)["x-forwarded-for"] || this.socket.request.connection.remoteAddress;
			return ip && await geoipLookup(ip);
		}

		/*copyPad : function(data, callback) {
			if(!stripObject(data, { toId: "string" }))
				return callback("Invalid parameters.");

			this.database.copyPad(this.padId, data.toId, callback);
		}*/
	};

	databaseHandlers: DatabaseHandlers = {
		line: (padId, data) => {
			if(padId == this.padId)
				this.socket.emit("line", data);
		},

		linePoints: (padId, lineId, trackPoints) => {
			if(padId == this.padId)
				this.socket.emit("linePoints", { reset: true, id: lineId, trackPoints : (this.bbox ? prepareForBoundingBox(trackPoints, this.bbox) : [ ]) });
		},

		deleteLine: (padId, data) => {
			if(padId == this.padId)
				this.socket.emit("deleteLine", data);
		},

		marker: (padId, data) => {
			if(padId == this.padId && this.bbox && isInBbox(data, this.bbox))
				this.socket.emit("marker", data);
		},

		deleteMarker: (padId, data) => {
			if(padId == this.padId)
				this.socket.emit("deleteMarker", data);
		},

		type: (padId, data) => {
			if(padId == this.padId)
				this.socket.emit("type", data);
		},

		deleteType: (padId, data) => {
			if(padId == this.padId)
				this.socket.emit("deleteType", data);
		},

		padData: (padId, data) => {
			if(padId == this.padId) {
				const dataClone = JSON.parse(JSON.stringify(data));
				if(this.writable == Writable.READ)
					dataClone.writeId = null;
				if(this.writable != Writable.ADMIN)
					dataClone.adminId = null;

				this.padId = data.id;

				this.socket.emit("padData", dataClone);
			}
		},

		deletePad: (padId) => {
			if (padId == this.padId) {
				this.socket.emit("deletePad");
				this.writable = Writable.READ;
			}
		},

		view: (padId, data) => {
			if(padId == this.padId)
				this.socket.emit("view", data);
		},

		deleteView: (padId, data) => {
			if(padId == this.padId)
				this.socket.emit("deleteView", data);
		}
	};
}
