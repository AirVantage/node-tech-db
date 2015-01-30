var events = require("events");
var Sequelize = require("sequelize");
var Migration = require("./lib/migration");
var wrapSql = require("./lib/wrapSql");

module.exports = function(configuration) {

    var emitter = new events.EventEmitter();

    var sequelize = new Sequelize(
        configuration.db.connection.database,
        configuration.db.connection.username,
        configuration.db.connection.password,
        configuration.db.connection.options);

    var migration = new Migration({
        sequelize: sequelize,
        Sequelize: Sequelize,
        config: configuration.db.migration
    });

    return {
        // The DB instance
        sequelize: sequelize,
        // The library that could be used to get all available DataTypes
        Sequelize: Sequelize,
        // Instance used to migrate the database
        migration: migration,

        dao: function(entityName) {

            var wrapper = wrapSql({
                sequelize: sequelize,
                entityName: entityName,
                emitter: emitter
            });

            return {
                find: wrapper.wrapByName("find", "Read"),
                findAll: wrapper.wrapByName("findAll", "Read"),
                findAndCountAll: wrapper.wrapByName("findAndCountAll", "Read"),
                sum: wrapper.wrapByName("sum", "Read"),
                create: wrapper.wrapByName("create", "Create"),
                destroy: wrapper.wrapByName("destroy", "Delete"),
                update: wrapper.wrapUpdate()
            };
        },
        on: emitter.on.bind(emitter)
    };
};
