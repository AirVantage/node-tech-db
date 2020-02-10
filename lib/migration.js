const _ = require('lodash');
const logger = require('logger');
const Umzug = require('umzug');
const schemaVersion = require('./schemaVersion');

/**
 * Allow to execute migration scripts.
 *
 * @param  {Object} options              See below for details description
 * @param  {Object} options.sequelize    Sequelize instance
 * @param  {Object} options.Sequelize    Reference to sequelize module
 * @param  {Object} options.lockService  LockService instance
 * @param  {Object} options.config       Configuration for the migration (optional)
 * Example of a configuration
 *        {
 *            path: migrations, // path of the directory containing the migration files
 *            pattern: /^\d{14}_.+\.js$/ // pattern of the migration files
 *        }
 */
module.exports = ({ sequelize, Sequelize, lockService, config = {} }) => {
  const umzug = new Umzug({
    storage: __dirname + '/storage/sequelize.js',
    storageOptions: { sequelize, Sequelize },

    upName: 'up',
    downName: 'down',

    migrations: {
      // Parameters passed to the methods 'up' and 'down'
      params: [sequelize, Sequelize],
      // The path of the directory containing the migration files.
      path: config.path || 'migrations',
      // The pattern of the migration files
      pattern: config.pattern || /^\d{14}_.+\.js$/
    }
  });

  const schemaUpdater = schemaVersion({ sequelize, Sequelize, lockService });

  return {
    /**
     * Get a lock and migrate the database to the specified schema version if needed.
     * The behavior of this method is the following.
     * 1. Get a lock
     * 2. If lock is acquired Then:
     *   2.1 Execute all pending migration files
     *   2.2 Update schema version
     *   2.3 Release the lock
     *
     * @param  {String}    version  the new schema version
     *
     * @return a Promise
     */
    up: version => {
      return schemaUpdater.updateSchema(version, () => {
        logger.debug('Migration up ...');
        return umzug.up().then(migrations => {
          if (migrations.length) {
            let files = '';
            migrations.forEach(migration => {
              files += '\n\t- ' + migration.file;
            });
            logger.info(`Executed migration files: ${files}`);
          } else {
            logger.info('There is no pending migration files');
          }
        });
      });
    },

    /**
     * Get a lock and migrate down the database to the specified schema version if needed.
     * The behavior of this method is the following.
     * 1. Get a lock
     * 2. If lock is acquired Then:
     *   2.1 Revert the last executed migration file
     *   2.2 Update schema version
     *   2.3 Release the lock
     *
     * @param  {String}    version  the new schema version
     *
     * @return a Promise
     */
    down: version => {
      return schemaUpdater.updateSchema(version, () => {
        logger.debug('Migration down ...');
        return umzug.down().then(migrations => {
          if (migrations.length) {
            let files = '';
            migrations.forEach(migration => {
              files += '\n\t- ' + migration.file;
            });
            logger.info(`Reverted migration files: ${files}`);
          } else {
            logger.info('All migration files have been reverted');
          }
        });
      });
    },

    getStatus: () => {
      return umzug.pending().then(pendings => {
        return umzug.executed().then(executed => {
          //add type flag on migrations
          _.forEach(pendings, pending => {
            pending.type = '[PENDING...] ';
          });

          _.forEach(executed, exec => {
            exec.type = '[EXECUTED]   ';
          });

          const allMigrations = _.union(pendings, executed);
          const sortedMigrations = _.sortBy(allMigrations, 'file');

          _.forEach(sortedMigrations, migration => logger.info(`${migration.type} ${migration.file}`));
        });
      });
    },

    /**
     * Drop all tables
     *
     * @return a Promise
     */
    clean: () => {
      logger.debug('Drop all tables');
      return sequelize.getQueryInterface().dropAllTables();
    }
  };
};
