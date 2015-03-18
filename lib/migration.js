var _ = require("lodash");
var logger = require("node-tech-logger");
var Umzug = require('umzug');
var schemaVersion = require("./schemaVersion");

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
module.exports = function(options) {
    var sequelize = options.sequelize;
    var Sequelize = options.Sequelize;
    var lockService = options.lockService;

    var migrationCfg = options.config || {};
    var umzug = new Umzug({
        storage: __dirname + '/storage/sequelize.js',
        storageOptions: {
            sequelize: sequelize,
            Sequelize: Sequelize
        },

        upName: 'up',
        downName: 'down',

        migrations: {
            // Parameters passed to the methods 'up' and 'down'
            params: [sequelize, Sequelize],
            // The path of the directory containing the migration files.
            path: migrationCfg.path || 'migrations',
            // The pattern of the migration files
            pattern: migrationCfg.pattern || /^\d{14}_.+\.js$/
        }
    });

    var schemaUpdater = schemaVersion({
        sequelize: sequelize,
        Sequelize: Sequelize,
        lockService: lockService
    });

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
        up: function(version) {
            return schemaUpdater.updateSchema(version, function() {
                logger.debug("Migration up ...");
                return umzug.up().then(function(migrations) {
                    if (migrations.length) {
                        var files = "";
                        migrations.forEach(function(migration) {
                            files += "\n\t- " + migration.file;
                        });
                        logger.info("Executed migration files:", files);
                    } else {
                        logger.info("There is no pending migration files");
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
        down: function(version) {
            return schemaUpdater.updateSchema(version, function() {
                logger.debug("Migration down ...");
                return umzug.down().then(function(migrations) {
                    if (migrations.length) {
                        var files = "";
                        migrations.forEach(function(migration) {
                            files += "\n\t- " + migration.file;
                        });
                        logger.info("Reverted migration files:", files);
                    } else {
                        logger.info("All migration files have been reverted");
                    }
                });
            });
        },

        getStatus: function() {
            return umzug.pending().then(function(pendings) {
                return umzug.executed().then(function(executed) {
                    //add type flag on migrations
                    _.each(pendings, function(pending) {
                        pending.type = "[PENDING...] ";
                    });

                    _.each(executed, function(exec) {
                        exec.type = "[EXECUTED]   ";
                    });

                    var allMigrations = _.union(pendings, executed);
                    var sortedMigrations = _.sortBy(allMigrations, "file");

                    _.each(sortedMigrations, function(migration) {
                        logger.info(migration.type, migration.file);
                    });
                });
            });
        },

        /**
         * Drop all tables
         *
         * @return a Promise
         */
        clean: function() {
            logger.debug("Drop all tables");
            return options.sequelize.getQueryInterface().dropAllTables();
        }
    };
};
