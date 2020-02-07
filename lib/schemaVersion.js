const logger = require('logger');

/**
 * Module used to update a db schema
 *
 * @param  {Object} options              See below for details description
 * @param  {Object} options.sequelize    Sequelize instance
 * @param  {Object} options.Sequelize    Reference to sequelize module
 * @param  {Object} options.lockService  LockService instance
 */
module.exports = ({ sequelize, Sequelize, lockService }) => {
  let initialized = false;

  // Define the model used to store the schema version
  const SchemaVersion = sequelize.define(
    'SchemaVersion',
    {
      id: { type: Sequelize.STRING(255), primaryKey: true, allowNull: false },
      version: { type: Sequelize.STRING(50) }
    },
    // Add the columns 'createdAt' and 'updatedAt'
    { timestamps: true }
  );

  /**
   * Create the table 'SchemaVersions' if needed.
   *
   * @return Promise
   */
  const _sync = () => {
    if (initialized) {
      return Promise.resolve();
    }
    logger.debug('SchemaVersion.sync() ...');
    initialized = true;
    return SchemaVersion.sync();
  };

  /**
   * Set the schema version
   * @param  {String} version the schema version
   *
   * @return Promise
   */
  const _updateSchemaVersion = version => {
    logger.info(`Update schema version to ${version}`);
    return _sync().then(() => SchemaVersion.upsert({ id: 'SCHEMA', version }));
  };

  return {
    /**
     * Get a lock, call the specified callback and update the schema version.
     * The behavior of this method is the following.
     * 1. Get the lock 'UPDATE_SCHEMA'
     * 2. If lock is acquired Then:
     *   2.1 Call the callback
     *   2.2 Update schema version
     *   2.3 Release the lock
     *
     * @param  {String}    version  the new schema version
     * @param  {Function}  callback the callback to call
     *
     * @return a Promise
     */
    updateSchema: (version, callback) => {
      if (!version || !version.length) {
        throw new Error('Schema version is not defined');
      }

      return lockService.doWithLock('UPDATE_SCHEMA', () => callback().then(() => _updateSchemaVersion(version)), {
        delay: 5000,
        attempt: 5,
        timeout: 120
      });
    }
  };
};
