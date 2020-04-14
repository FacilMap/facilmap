const Sequelize = require("sequelize");
const similarity = require("string-similarity");

const Op = Sequelize.Op;

module.exports = (Database) => {
	Object.assign(Database.prototype, {

		async search(padId, searchText) {
			let objects = [].concat(...(await Promise.all([ "Marker", "Line" ].map(async (kind) => {
				let objs = await this._conn.model(kind).findAll({
					where: Sequelize.and(
						{ padId },
						Sequelize.where(Sequelize.fn("lower", Sequelize.col(`${kind}.name`)), {[Op.like]: `%${searchText.toLowerCase()}%`})
					),
					attributes: [ "id", "name", "typeId" ].concat(kind == "Marker" ? [ "lat", "lon", "symbol" ] : [ "top", "left", "bottom", "right" ])
				});

				return objs.map((obj) => (Object.assign(JSON.parse(JSON.stringify(obj)), {
					kind: kind.toLowerCase(),
					similarity: similarity.compareTwoStrings(searchText, obj.name)
				})));
			}))));

			objects.sort((a, b) => (b.similarity - a.similarity));

			return objects;
		}

	});
};