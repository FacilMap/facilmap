const compileExpression = require('filtrex');

const utils = require('./utils');

const filter = module.exports = {
	_customFuncs: {
		prop(obj, key) {
			return obj && obj[key];
		},

		random() { } // Does not work well with angular digest cycles
	},

	hasError(expr) {
		try {
			if(expr && expr.trim())
				compileExpression(expr, filter._customFuncs);
		} catch(e) {
			return e;
		}
	},

	compileExpression(expr) {
		if(!expr || !expr.trim())
			return function() { return true; };
		else {
			let currentVal;
			let customFuncs = { };
			Object.keys(filter._customFuncs).forEach(function(i) {
				customFuncs[i] = function() {
					return filter._customFuncs[i].apply(currentVal, arguments);
				};
			});

			let func = compileExpression(expr, customFuncs);
			return function(val) {
				try {
					currentVal = val;
					return func(val);
				} finally {
					currentVal = null;
				}
			};
		}
	},

	quote(str) {
		return '"' + (""+str).replace(/["\\]/g, '\\$1').replace(/\n/g, "\\n") + '"';
	},

	_getMatchesWithBrackets(str, regexp) {
		let ret = [ ];

		(str || "").replace(new RegExp(regexp, "gi"), function() {
			let offset = arguments[arguments.length-2];
			let match = arguments[0];

			let open = match.match(/\(/g);
			let close = match.match(/\)/g);
			let needBraces = (open ? open.length : 0) - (close ? close.length : 0);
			for(var i=offset+match.length; i<str.length && needBraces > 0; i++) {
				if(str[i] == "(")
					needBraces++;
				else if(str[i] == ")")
					needBraces--;
			}

			ret.push(str.substring(offset, i));
		});

		return ret;
	},

	makeTypeFilter: function(previousFilter, typeId, filteredData) {
		function removePart(str, regexp) {
			str = str || "";
			regexp.forEach(function(r) {
				str = str
					.replace(new RegExp("^" + r + "($|\\s+and\\s+|\\s+or\\s+)", "ig"), "")
					.replace(new RegExp("\\s+(and|or)\\s+" + r + "($|[^0-9a-z])", "ig"), function() { return arguments[arguments.length-3]; })
			});
			return str;
		}

		let ret = removePart(previousFilter,
			filter._getMatchesWithBrackets(previousFilter, "(not\\s+)?\\(typeId\\s*==\\s*" + typeId).map(utils.quoteRegExp)
				.concat([ "typeId\\s*[!=]=\\s*" + typeId ]));

		if(typeof filteredData == "boolean") {
			if(filteredData)
				ret = (ret ? ret + " and " : "") + "typeId!=" + typeId;
		} else {
			var append = [ ];
			for(var i in filteredData) {
				var no = Object.keys(filteredData[i]).filter(function(it) { return !filteredData[i][it]; });
				var yes = Object.keys(filteredData[i]).filter(function(it) { return filteredData[i][it]; });

				if(no.length == 0) // No item is not filtered, so we can filter the whole type
					return (ret ? ret + " and " : "") + "typeId!=" + typeId;

				if(yes.length > 0) {
					var negative = "prop(data," + filter.quote(i) + ")" + (no.length > 1 ? " not in (" + no.map(filter.quote).join(",") + ")" : "!=" + filter.quote(no[0]));
					var positive = "prop(data," + filter.quote(i) + ")" + (yes.length > 1 ? " in (" + yes.map(filter.quote).join(",") + ")" : "==" + filter.quote(yes[0]));

					append.push(negative.length < positive.length ? negative : positive);
				}
			}

			if(append.length > 0)
				ret = (ret ? ret + " and " : "") + "not (typeId=="+typeId+" and " + (append.length > 1 ? "(" + append.join(" or ") + ")" : append[0]) + ")";
		}

		return ret;
	},

	prepareObject: function(obj, type) {
		obj = filter.flattenObject(JSON.parse(JSON.stringify(obj)));

		if(type)
			obj.type = type.type;

		return obj;
	},

	flattenObject(data) {
		// https://stackoverflow.com/a/19101235/242365

		var result = {};
		function recurse (cur, prop) {
		    if(prop)
		        result[prop] = cur;

		    if(Array.isArray(cur)) {
		         for(var i=0, l=cur.length; i<l; i++)
		             recurse(cur[i], prop + "." + i);
		    } else if(Object(cur) === cur) {
		        for (var p in cur) {
		            recurse(cur[p], prop ? prop+"."+p : p);
		        }
		    }
		}
		recurse(data, "");
		return result;
	}
};