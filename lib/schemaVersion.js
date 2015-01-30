var logger = require("node-tech-logger");
var BPromise = require("bluebird");

/**
 * Module used to update a db schema
 *
 * @param  {Object} options              See below for details description
 * @param  {Object} options.sequelize    Sequelize instance
 * @param  {Object} options.Sequelize    Reference to sequelize module
 */
module.exports = function(options) {
    // Define the model used to store the schema version
    var SchemaVersion = options.sequelize.define("SchemaVersion", {
        id: {
            type: options.Sequelize.STRING(255),
            primaryKey: true,
            allowNull: false
        },
        version: {
            type: options.Sequelize.STRING(50),
        }
    }, {
        // Add the columns 'createdAt' and 'updatedAt'
        timestamps: true
    });

    var updateSchemaVersion = function(version) {
        logger.debug("Update schema version to", version);
        return SchemaVersion.upsert({
            id: 'SCHEMA',
            version: version
        });
    };

    var acquireLock = function(attempt) {
        logger.debug("Try to acquire the lock (attempt=" + attempt + ") ...");
        return SchemaVersion.create({
            id: 'LOCK'
        }).catch(function(err) {
            if (attempt < 5) {
                logger.warn("Cannot acquire the lock. Retry in a few seconds.");
                return BPromise.delay(5000).then(function() {
                    return acquireLock(++attempt);
                });
            }
            throw new Error("Cannot acquire the lock");
        });
    };

    var releaseLock = function() {
        logger.debug("Release the lock");
        return SchemaVersion.destroy({
            where: {
                id: 'LOCK'
            }
        });
    };

    return {

        /**
         * Get a lock, call the specified callback and update the schema version.
         * The behavior of this method is the following.
         * 1. Get a lock
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
        updateSchema: function(newVersion, callback) {
            if (!newVersion || !newVersion.length) {
                throw new Error("Schema version is not defined");
            }

            var hasLock = false;
            return options.sequelize.sync({
                    force: false
                })
                .then(function() {
                    return acquireLock(1);
                })
                .then(function() {
                    hasLock = true;
                    return callback();
                })
                .then(function() {
                    return updateSchemaVersion(newVersion);
                })
                .finally(function() {
                    if (hasLock) {
                        return releaseLock();
                    }
                });
        }
    };
};
