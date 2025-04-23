import { DataTypes, type InferAttributes, type InferCreationAttributes, Model, Op, type WhereOptions } from "sequelize";
import DatabaseBackend from "./database-backend.js";
import type { BboxWithExcept, BboxWithZoom, Latitude, Longitude, TrackPoint } from "facilmap-types";
import { bulkCreateInBatches, createModel, findAllStreamed, getPosType, getVirtualLatType, getVirtualLonType, makeBboxCondition } from "./utils.js";
import { omit } from "lodash-es";
import type { Point as GeoJsonPoint } from "geojson";

interface RoutePointModel extends Model<InferAttributes<RoutePointModel>, InferCreationAttributes<RoutePointModel>> {
	routeId: string;
	lat: Latitude;
	lon: Longitude;
	pos: GeoJsonPoint;
	zoom: number;
	idx: number;
	ele: number | null;
}

export default class DatabaseRoutesBackend {

	private RoutePointModel = createModel<RoutePointModel>();

	backend: DatabaseBackend;

	constructor(backend: DatabaseBackend) {
		this.backend = backend;

		this.RoutePointModel.init({
			routeId: { type: DataTypes.STRING, allowNull: false },
			lat: getVirtualLatType(),
			lon: getVirtualLonType(),
			pos: getPosType(),
			zoom: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, validate: { min: 1, max: 20 } },
			idx: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
			ele: {
				type: DataTypes.INTEGER,
				allowNull: true,
				set: function(this: RoutePointModel, v: number | null) {
					// Round number to avoid integer column error in Postgres
					this.setDataValue("ele", v != null ? Math.round(v) : v);
				}
			}
		}, {
			sequelize: this.backend._conn,
			indexes: [
				{ fields: [ "routeId", "zoom" ] }
				// pos index is created in migration
			],
			modelName: "RoutePoint"
		});
	}

	async truncateRoutePoints(): Promise<void> {
		await this.RoutePointModel.truncate();
	}

	async getRoutePoints(routeId: string, bboxWithZoom?: BboxWithZoom & BboxWithExcept, getCompleteBasicRoute = false): Promise<TrackPoint[]> {
		const cond: WhereOptions = {
			routeId,
			...(!bboxWithZoom ? {} : {
				[Op.or]: [
					{ [Op.and]: [ makeBboxCondition(this.backend, bboxWithZoom), { zoom: { [Op.lte]: bboxWithZoom.zoom } } ] },
					...(!getCompleteBasicRoute ? [] : [
						{ zoom: { [Op.lte]: 5 } }
					])
				]
			})
		};

		return (await this.RoutePointModel.findAll({
			where: cond,
			attributes: [ "pos", "lat", "lon", "idx", "ele"],
			order: [[ "idx", "ASC" ]]
		})).map((point) => omit(point.toJSON(), ["pos"]) as TrackPoint);
	}

	async setRoutePoints(routeId: string, trackPoints: TrackPoint[], options?: { noClear?: boolean; signal?: AbortSignal }): Promise<void> {
		if (!options?.noClear) {
			await this.deleteRoute(routeId);
		}

		await bulkCreateInBatches(this.RoutePointModel, trackPoints.map((p) => ({ ...p, routeId }), { signal: options?.signal }));
	}

	async deleteRoute(routeId: string): Promise<void> {
		await this.RoutePointModel.destroy({
			where: {
				routeId
			}
		});
	}

	async getRoutePointsByIdx(routeId: string, indexes: number[]): Promise<TrackPoint[]> {
		const data = await this.RoutePointModel.findAll({
			where: { routeId, idx: indexes },
			attributes: [ "pos", "lat", "lon", "idx", "ele" ],
			order: [[ "idx", "ASC" ]]
		});
		return data.map((d) => omit(d.toJSON(), ["pos"]) as TrackPoint);
	}

	async* getAllRoutePoints(routeId: string): AsyncIterable<TrackPoint> {
		for await (const routePoint of findAllStreamed(this.RoutePointModel, {
			where: { routeId },
			attributes: [ /* Needed for findAllStreamed */ "id", "pos", "lat", "lon", "idx", "ele", "zoom"]
		})) {
			yield omit(routePoint.toJSON(), ["id", "pos"]) as TrackPoint;
		}
	}

}
