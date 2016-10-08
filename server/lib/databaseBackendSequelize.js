var Sequelize = require("sequelize");
var config = require("../config");
var utils = require("./utils");
var async = require("async");

var conn = new Sequelize(config.db.database, config.db.user, config.db.password, {
	dialect: config.db.type,
	host: config.db.host,
	port: config.db.port,
	define: {
		timestamps: false
	}
});


/*********************/
/* Types and Helpers */
/*********************/

function getLatType() {
	return {
		type: Sequelize.FLOAT(9, 6),
		allowNull: false,
		validate: {
			min: -90,
			max: 90
		}
	};
}

function getLonType() {
	return {
		type: Sequelize.FLOAT(9, 6),
		allowNull: false,
		validate: {
			min: -180,
			max: 180
		}
	};
}

var validateColour = { is: /^[a-fA-F0-9]{3}([a-fA-F0-9]{3})?$/ };

var dataDefinition = {
	"name" : { type: Sequelize.TEXT, allowNull: false },
	"value" : { type: Sequelize.TEXT, allowNull: false }
};

function _makeNotNullForeignKey(type, field, error) {
	return {
		as: type,
		onDelete: error ? "RESTRICT" : "CASCADE",
		foreignKey: { name: field, allowNull: false }
	}
}


/**********/
/* Tables */
/**********/

/* Pads */

var Pad = conn.define("Pad", {
	id : { type: Sequelize.STRING, allowNull: false, unique: "padId", primaryKey: true },
	name: { type: Sequelize.TEXT, allowNull: true, get: function() { return this.getDataValue("name") || "New FacilPad"; } },
	writeId: { type: Sequelize.STRING, allowNull: false, unique: "padId" }
});


/* Markers */

var Marker = conn.define("Marker", {
	"lat" : getLatType(),
	"lon" : getLonType(),
	name : { type: Sequelize.TEXT, allowNull: true, get: function() { return this.getDataValue("name") || "Untitled marker"; } },
	colour : { type: Sequelize.STRING(6), allowNull: false, defaultValue: "ff0000", validate: validateColour }
});

Pad.hasMany(Marker, { foreignKey: "padId" });
Marker.belongsTo(Pad, _makeNotNullForeignKey("pad", "padId"));

var MarkerData = conn.define("MarkerData", dataDefinition);

MarkerData.belongsTo(Marker, _makeNotNullForeignKey("marker", "markerId"));
Marker.hasMany(MarkerData, { foreignKey: "markerId" });


/* Lines */

var Line = conn.define("Line", {
	routePoints : {
		type: Sequelize.TEXT,
		allowNull: false,
		get: function() {
			var routePoints = this.getDataValue("routePoints");
			return routePoints != null ? JSON.parse(routePoints) : routePoints;
		},
		set: function(v) {
			for(var i=0; i<v.length; i++) {
				v[i].lat = 1*v[i].lat.toFixed(6);
				v[i].lon = 1*v[i].lon.toFixed(6);
			}
			this.setDataValue("routePoints", JSON.stringify(v));
		},
		validate: {
			minTwo: function(val) {
				var routePoints = JSON.parse(val);
				if(!Array.isArray(routePoints))
					throw new Error("routePoints is not an array");
				if(routePoints.length < 2)
					throw new Error("A line cannot have less than two route points.");
			}
		}
	},
	mode : { type: Sequelize.ENUM("", "fastest", "shortest", "bicycle", "pedestrian"), allowNull: false, defaultValue: "" },
	colour : { type: Sequelize.STRING(6), allowNull: false, defaultValue: "0000ff", validate: validateColour },
	width : { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 4, validate: { min: 1 } },
	name : { type: Sequelize.TEXT, allowNull: true, get: function() { return this.getDataValue("name") || "Untitled line"; } },
	distance : { type: Sequelize.FLOAT(24, 2).UNSIGNED, allowNull: true },
	time : { type: Sequelize.INTEGER.UNSIGNED, allowNull: true }
});

Pad.hasMany(Line, { foreignKey: "padId" });
Line.belongsTo(Pad, _makeNotNullForeignKey("pad", "padId"));

var LinePoint = conn.define("LinePoint", {
	lat: getLatType(),
	lon: getLonType(),
	zoom: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, validate: { min: 1, max: 20 } },
	idx: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false }
});

LinePoint.belongsTo(Line, _makeNotNullForeignKey("line", "lineId"));
Line.hasMany(LinePoint, { foreignKey: "lineId" });

var LineData = conn.define("LineData", dataDefinition);

LineData.belongsTo(Line, _makeNotNullForeignKey("line", "lineId"));
Line.hasMany(LineData, { foreignKey: "lineId" });


/* Views */

var View = conn.define("View", {
	name : { type: Sequelize.TEXT, allowNull: false },
	baseLayer : { type: Sequelize.TEXT, allowNull: false },
	layers : {
		type: Sequelize.TEXT,
		allowNull: false,
		get: function() {
			return JSON.parse(this.getDataValue("layers"));
		},
		set: function(v) {
			this.setDataValue("layers", JSON.stringify(v));
		}
	},
	top : getLatType(),
	bottom : getLatType(),
	left : getLonType(),
	right : getLonType()
});

Pad.hasMany(View, { foreignKey: "padId" });
View.belongsTo(Pad, _makeNotNullForeignKey("pad", "padId"));

Pad.belongsTo(View, { as: "defaultView", foreignKey: "defaultViewId", constraints: false });


/* Types */

var Type = conn.define("Type", {
	name: { type: Sequelize.TEXT, allowNull: false },
	type: { type: Sequelize.ENUM("marker", "line"), allowNull: false },
	fields: {
		type: Sequelize.TEXT,
		allowNull: false,
		get: function() {
			return JSON.parse(this.getDataValue("fields"));
		},
		set: function(v) {
			return this.setDataValue("fields", JSON.stringify(v));
		},
		validate: {
			checkUniqueFieldName: function(obj) {
				obj = JSON.parse(obj);
				var fields = { };
				for(var i=0; i<obj.length; i++) {
					if(obj[i].name.trim().length == 0)
						throw new Error("Empty field name.");
					if(fields[obj[i].name])
						throw new Error("field name "+obj[i].name+" is not unique.");
					fields[obj[i].name] = true;
					if([ "textarea", "dropdown", "checkbox", "input" ].indexOf(obj[i].type) == -1)
						throw new Error("Invalid field type "+obj[i].type+" for field "+obj[i].name+".");
					if(obj[i].controlColour) {
						if(!obj[i].options || obj[i].options.length < 1)
							throw new Error("No options specified for colour-controlling field "+obj[i].name+".");
						for(var j=0; j<obj[i].options.length; j++) {
							if(!obj[i].options[j].colour || !obj[i].options[j].colour.match(/^[a-fA-F0-9]{6}$/))
								throw new Error("Invalid colour "+obj[i].options[j].colour+" in field "+obj[i].name+".");
						}
					}
					if(obj[i].controlWidth) {
						if(!obj[i].options || obj[i].options.length < 1)
							throw new Error("No options specified for width-controlling field "+obj[i].name+".");
						for(var j=0; j<obj[i].options.length; j++) {
							if(!obj[i].options[j].width || !(1*obj[i].options[j].width >= 1))
								throw new Error("Invalid width "+obj[i].options[j].width+" in field "+obj[i].name+".");
						}
					}
				}
			}
		}
	}
});

Pad.hasMany(Type, { foreignKey: "padId" });
Type.belongsTo(Pad, _makeNotNullForeignKey("pad", "padId"));

Marker.belongsTo(Type, _makeNotNullForeignKey("type", "typeId", true));
Line.belongsTo(Type, _makeNotNullForeignKey("type", "typeId", true));


function connect(callback, force) {
	async.series([
		function(next) {
			_promiseComplete(conn.authenticate(), next);
		},
		function(next) {
			_promiseComplete(conn.sync({ force: !!force }), next);
		},
		function(next) {
			// Migrations

			var queryInterface = conn.getQueryInterface();
			Promise.all([
				// Rename Line.points to Line.routePoints
				queryInterface.describeTable('Lines').then(function(attributes) {
					if(attributes.points) {
						return queryInterface.renameColumn('Lines', 'points', 'routePoints');
					}
				})
			].concat([ 'Pads', 'Markers', 'Lines' ].map(function(table) {
				// allow null on Pad.name, Marker.name, Line.name
				return queryInterface.describeTable(table).then(function(attributes) {
					if(!attributes.name.allowNull)
						return queryInterface.changeColumn(table, 'name', { type: Sequelize.TEXT, allowNull: true });
				});
			})))
			.then(function() { next(); })
			.catch(function(err) { next(err); });
		}
	], callback);
}

function getPadData(padId, callback) {
	_promiseComplete(Pad.findOne({ where: { id: padId }, include: [ { model: View, as: "defaultView" } ]}), callback);
}

function getPadDataByWriteId(writeId, callback) {
	_promiseComplete(Pad.findOne({ where: { writeId: writeId }, include: [ { model: View, as: "defaultView" } ] }), callback);
}

function createPad(padId, writeId, callback) {
	_promiseComplete(Pad.create({ id: padId, writeId: writeId }), callback);
}

function updatePadData(padId, data, callback) {
	async.waterfall([
		function(next) {
			_promiseComplete(Pad.update(data, { where: { id: padId } }), next);
		},
		function(affectedNumber, next) {
			getPadData(padId, next);
		}
	], callback);
}

function _getPadObjects(type, padId, condition) {
	var ret = new utils.ArrayStream();

	Pad.build({ id: padId })["get"+type+"s"](condition).then(function(objs) {
		objs.forEach(function(it) {
			if(it[type+"Data"] != null) {
				it.data = _dataFromArr(it[type+"Data"]);
				it.setDataValue("data", it.data); // For JSON.stringify()
				it.setDataValue(type+"Data", undefined);
			}
		});

		ret.receiveArray(null, objs);
	}, function(err) {
		ret.receiveArray(err);
	});
	return ret;
}

function _createPadObject(type, padId, data, callback) {
	var obj = conn.model(type).build(data);
	obj.padId = padId;
	_promiseComplete(obj.save(), callback);
}

function _createPadObjectWithData(type, padId, data, callback) {
	async.auto({
		obj: function(next) {
			_createPadObject(type, padId, data, next);
		},
		data: [ "obj", function(res, next) {
			if(data.data != null) {
				res.obj.data = data.data;
				res.obj.setDataValue("data", res.obj.data); // For JSON.stringify()
				_setObjectData(type, res.obj.id, data.data, next);
			}
			else {
				res.obj.data = { };
				res.obj.setDataValue("data", res.obj.data); // For JSON.stringify()
				next();
			}
		} ]
	}, function(err, res) {
		callback(err, res.obj);
	});
}

function _updatePadObject(type, objId, data, callback) {
	async.waterfall([
		function(next) {
			_promiseComplete(conn.model(type).update(data, { where: { id: objId } }), next);
		},
		function(affectedCount, next) {
			_promiseComplete(conn.model(type).findById(objId), next);
		}
	], callback);
}

function _updatePadObjectWithData(type, objId, data, callback) {
	async.auto({
		obj: function(next) {
			_updatePadObject(type, objId, data, next);
		},
		data: function(next) {
			if(data.data != null)
				_setObjectData(type, objId, data.data, next);
			else
				next();
		},
		getData: function(next) {
			if(data.data == null)
				_getObjectData(type, objId, next);
			else
				next();
		}
	}, function(err, res) {
		if(err)
			return callback(err);

		res.obj.data = (data.data != null ? data.data : res.getData);
		res.obj.setDataValue("data", res.obj.data); // For JSON.stringify()
		callback(null, res.obj);
	});
}

function _deletePadObject(type, objId, callback) {
	conn.model(type).findById(objId).then(function(obj) {
		return obj.destroy().then(function() {
			callback(null, obj);
		});
	}).catch(callback);
}

function _deletePadObjectWithData(type, objId, callback) {
	async.series([
		function(next) {
			_setObjectData(type, objId, { }, next);
		},
		function(next) {
			_deletePadObject(type, objId, callback); // Pass on object to callback
		}
	], callback);
}

function _dataToArr(data, extend) {
	var dataArr = [ ];
	for(var i in data)
		dataArr.push(utils.extend({ name: i, value: data[i] }, extend));
	return dataArr;
}

function _dataFromArr(dataArr) {
	var data = { };
	for(var i=0; i<dataArr.length; i++)
		data[dataArr[i].name] = dataArr[i].value;
	return data;
}

function _getObjectData(type, objId, callback) {
	var filter = { };
	filter[type.toLowerCase()+"Id"] = objId;

	conn.model(type+"Data").findAll({ where: filter}).then(function(dataArr) {
		callback(null, _dataFromArr(dataArr));
	}, callback);
}

function _setObjectData(type, objId, data, callback) {
	var model = conn.model(type+"Data");
	var idObj = { };
	idObj[type.toLowerCase()+"Id"] = objId;

	async.series([
		function(next) {
			_promiseComplete(model.destroy({ where: idObj}), next);
		},
		function(next) {
			_promiseComplete(model.bulkCreate(_dataToArr(data, idObj)), next);
		}
	], callback);
}

function getViews(padId) {
	return _getPadObjects("View", padId);
}

function createView(padId, data, callback) {
	_createPadObject("View", padId, data, callback);
}

function updateView(viewId, data, callback) {
	_updatePadObject("View", viewId, data, callback);
}

function deleteView(viewId, callback) {
	_deletePadObject("View", viewId, callback);
}

function getType(typeId, callback) {
	_promiseComplete(Type.findById(typeId), callback);
}

function getTypes(padId) {
	return _getPadObjects("Type", padId);
}

function createType(padId, data, callback) {
	_createPadObject("Type", padId, data, callback);
}

function updateType(typeId, data, callback) {
	_updatePadObject("Type", typeId, data, callback);
}

function deleteType(typeId, callback) {
	_deletePadObject("Type", typeId, callback);
}

function isTypeUsed(typeId, callback) {
	async.series([
		function(next) {
			_promiseComplete(Marker.findOne({ where: { typeId: typeId } }), next);
		},
		function(next) {
			_promiseComplete(Line.findOne({ where: { typeId: typeId } }), next);
		}
	], function(err, res) {
		callback(err, res[0] != null || res[1] != null);
	});
}

function getPadMarkers(padId, bbox) {
	return _getPadObjects("Marker", padId, { where: _makeBboxCondition(bbox), include: [ MarkerData ] });
}

function getPadMarkersByType(padId, typeId) {
	return _getPadObjects("Marker", padId, { where: { typeId: typeId }, include: [ MarkerData ] });
}

function createMarker(padId, data, callback) {
	_createPadObjectWithData("Marker", padId, data, callback);
}

function updateMarker(markerId, data, callback) {
	_updatePadObjectWithData("Marker", markerId, data, callback);
}

function deleteMarker(markerId, callback) {
	_deletePadObjectWithData("Marker", markerId, callback);
}

function getPadLines(padId, fields) {
	var cond = { include: [ LineData ] };
	if(fields)
		cond.attributes = (typeof fields == "string" ? fields.split(/\s+/) : fields);

	return _getPadObjects("Line", padId, cond);
}

function getPadLinesByType(padId, typeId) {
	return _getPadObjects("Line", padId, { where: { typeId: typeId }, include: [ LineData ] });
}

function getLineTemplate(data, callback) {
	var line = JSON.parse(JSON.stringify(Line.build(data)));
	line.data = data.data || { };
	callback(null, line);
}

function getLine(lineId, callback) {
	_promiseComplete(Line.findOne({ where: { id: lineId }, include: [ LineData ] }), callback);
}

function createLine(padId, data, callback) {
	_createPadObjectWithData("Line", padId, data, callback);
}

function updateLine(lineId, data, callback) {
	_updatePadObjectWithData("Line", lineId, data, callback);
}

function deleteLine(lineId, callback) {
	_deletePadObjectWithData("Line", lineId, callback);
}

function getLinePoints(lineId, callback) {
	_promiseComplete(Line.build({ id: lineId }).getLinePoints(), callback);
}

function getLinePointsByBbox(lineId, bboxWithZoom, callback) {
	_promiseComplete(Line.build({ id: lineId }).getLinePoints({
		where: Sequelize.and(_makeBboxCondition(bboxWithZoom), bboxWithZoom ? { zoom: { lte: bboxWithZoom.zoom } } : null),
		attributes: [ "idx" ],
		order: "idx"
	}), callback);
}

function getLinePointsByIdx(lineId, indexes, callback) {
	_promiseComplete(Line.build({ id: lineId }).getLinePoints({
		where: { idx: indexes },
		attributes: [ "lon", "lat", "idx" ],
		order: "idx"
	}), callback);
}

function setLinePoints(lineId, trackPoints, callback) {
	async.series([
		function(next) {
			_promiseComplete(LinePoint.destroy({ where: { lineId: lineId } }), next);
		},
		function(next) {
			var create = [ ];
			for(var i=0; i<trackPoints.length; i++) {
				create.push(utils.extend({ }, trackPoints[i], { lineId: lineId }));
			}

			_promiseComplete(LinePoint.bulkCreate(create), next);
		}
	], callback);
}

function _makeBboxCondition(bbox, prefix) {
	if(!bbox)
		return { };

	prefix = prefix || "";

	function cond(key, value) {
		var ret = { };
		ret[prefix+key] = value;
		return ret;
	}

	var conditions = [ ];
	conditions.push(cond("lat", { lte: bbox.top, gte: bbox.bottom }));

	if(bbox.right < bbox.left) // Bbox spans over lon=180
		conditions.push(Sequelize.or(cond("lon", { gte: bbox.left }), cond("lon", { lte: bbox.right })));
	else
		conditions.push(cond("lon", { gte: bbox.left, lte: bbox.right }));

	if(bbox.except) {
		var exceptConditions = [ ];
		exceptConditions.push(Sequelize.or(cond("lat", { gt: bbox.except.top }), cond("lat", { lt: bbox.except.bottom })));

		if(bbox.except.right < bbox.except.left)
			exceptConditions.push(cond("lon", { lt: bbox.except.left, gt: bbox.except.right }));
		else
			exceptConditions.push(Sequelize.or(cond("lon", { lt: bbox.except.left }), cond("lon", { gt: bbox.except.right })));
		conditions.push(Sequelize.or.apply(Sequelize, exceptConditions));
	}

	return Sequelize.and.apply(Sequelize, conditions);
}

function _promiseComplete(promise, callback) {
	promise.then(function() {
		callback.apply(this, [ null ].concat([].slice.call(arguments)));
	}, function(err) {
		callback(err);
	});
}

module.exports = {
	connect : connect,
	getPadData : getPadData,
	getPadDataByWriteId : getPadDataByWriteId,
	createPad : createPad,
	updatePadData : updatePadData,
	getViews : getViews,
	createView : createView,
	updateView : updateView,
	deleteView : deleteView,
	getType : getType,
	getTypes : getTypes,
	createType : createType,
	updateType : updateType,
	deleteType : deleteType,
	isTypeUsed : isTypeUsed,
	getPadMarkers : getPadMarkers,
	getPadMarkersByType : getPadMarkersByType,
	createMarker : createMarker,
	updateMarker : updateMarker,
	deleteMarker : deleteMarker,
	getPadLines : getPadLines,
	getPadLinesByType : getPadLinesByType,
	getLine : getLine,
	getLineTemplate : getLineTemplate,
	createLine : createLine,
	updateLine : updateLine,
	deleteLine : deleteLine,
	getLinePoints : getLinePoints,
	getLinePointsByBbox : getLinePointsByBbox,
	getLinePointsByIdx : getLinePointsByIdx,
	setLinePoints : setLinePoints,
	_models : {
		Pad: Pad,
		Marker: Marker,
		MarkerData: MarkerData,
		Line: Line,
		LineData: LineData,
		LinePoint: LinePoint,
		View: View,
		Type: Type
	},
	_conn : conn
};