const events = require('events');
const Sequelize = require('sequelize');
const migration = require('./lib/migration');
const wrapSql = require('./lib/wrapSql');
const lockService = require('./lib/lockService');

module.exports = configuration => {
  const emitter = new events.EventEmitter();

  const sequelize = new Sequelize(
    configuration.db.connection.database,
    configuration.db.connection.username,
    configuration.db.connection.password,
    configuration.db.connection.options
  );

  const lockServiceInstance = lockService({ sequelize, Sequelize });

  const migrationInstance = migration({
    sequelize,
    Sequelize,
    lockService: lockServiceInstance,
    config: configuration.db.migration
  });

  return {
    // The DB instance
    sequelize,
    // The library that could be used to get all available DataTypes
    Sequelize,
    // Instance used to migrate the database
    migration: migrationInstance,
    // Lock service
    lockService: lockServiceInstance,

    dao: entityName => {
      const wrapper = wrapSql({ sequelize, entityName, emitter });

      return {
        find: wrapper.wrapByName('find', 'Read'),
        findAll: wrapper.wrapByName('findAll', 'Read'),
        findAndCountAll: wrapper.wrapByName('findAndCountAll', 'Read'),
        sum: wrapper.wrapByName('sum', 'Read'),
        create: wrapper.wrapByName('create', 'Create'),
        destroy: wrapper.wrapByName('destroy', 'Delete'),
        update: wrapper.wrapUpdate()
      };
    },
    on: emitter.on.bind(emitter)
  };
};
