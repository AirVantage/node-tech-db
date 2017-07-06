var logger = require('node-tech-logger');
var BPromise = require('bluebird');

/**
 * Service used to acquire a lock.
 *
 * @param  {Object} options              See below for details description
 * @param  {Object} options.sequelize    Sequelize instance
 * @param  {Object} options.Sequelize    Reference to sequelize module
 */
module.exports = function(options) {
  var sequelize = options.sequelize;
  var Sequelize = options.Sequelize;
  var initialized = false;

  // Define the model used to store the locks
  var Lock = sequelize.define(
    'Lock',
    {
      id: {
        type: Sequelize.STRING(255),
        primaryKey: true,
        allowNull: false
      },
      timeout: {
        type: Sequelize.DATE,
        allowNull: false
      }
    },
    {
      // Add the column 'createdAt'
      timestamps: true,
      updatedAt: false
    }
  );

  /**
     * Create the table 'Locks' if needed.
     *
     * @return Promise
     */
  var _sync = function() {
    if (initialized) {
      return BPromise.resolve();
    }
    logger.debug('Lock.sync() ...');
    initialized = true;
    return Lock.sync();
  };

  /**
     * Delete all locks which are considered as expired
     *
     * @return Promise
     */
  var _deleteOldLocks = function() {
    return Lock.destroy({
      where: {
        timeout: {
          lte: new Date()
        }
      }
    });
  };

  /**
     * Create a lock with the given name.
     *
     * @param  {String}  name      The name of the lock
     * @param  {Integer} timeout   The number of seconds where the lock is considered as expired
     * @return Promise
     */
  var _createLock = function(name, timeout) {
    return Lock.create({
      id: name,
      timeout: new Date(new Date().getTime() + timeout * 1000)
    });
  };

  /**
     * Acquire a lock with the specified name.
     *
     * @param  {String}  name         The name of the lock
     * @param  {Integer} timeout      The number of seconds where the lock is considered as expired
     * @param  {Integer} attempt      The current attempt
     * @param  {Integer} maxAttempt   The maximum number of attempt to acquire a lock
     * @param  {Integer} delay        The delay between 2 attempts
     *
     * @return Promise
     */
  var _acquireLock = function(name, timeoutInSec, attempt, maxAttempt, delayInMs) {
    logger.debug(
      "Try to acquire the lock '" +
        name +
        "' (attempt=" +
        attempt +
        '/' +
        maxAttempt +
        ', timeout=' +
        timeoutInSec +
        's) ...'
    );

    return _deleteOldLocks()
      .then(function() {
        return _createLock(name, timeoutInSec);
      })
      .catch(function(err) {
        if (attempt < maxAttempt) {
          logger.warn("Cannot acquire the lock '" + name + "'. Retry in " + delayInMs + ' milliseconds.');
          return BPromise.delay(delayInMs).then(function() {
            return _acquireLock(name, timeoutInSec, ++attempt, maxAttempt, delayInMs);
          });
        }
        throw new Error("Cannot acquire the lock '" + name + "'");
      });
  };

  /**
     * Acquire a lock with the specified name.
     *
     *
     * @param  {String}   name              The name of the lock to acquire
     * @param  {Object}   options           See below for details description
     * @param  {Integer}  options.attempt   The number of attempt to acquire a lock. Default value: 1.
     * @param  {Integer}  options.delay     The delay between 2 attempts. Default value: 500ms.
     * @param  {Integer}  options.timeout   The number of seconds where the lock is considered as expired. Default value: 60s.
     *
     * @return Promise
     */
  var _lock = function(name, options) {
    var opt = options || {};
    var maxAttempt = opt.attempt || 1;
    var delay = opt.delay || 500;
    var timeout = opt.timeout || 60;

    return _sync().then(function() {
      return _acquireLock(name, timeout, 1, maxAttempt, delay);
    });
  };

  /**
     * Delete the lock with the given name
     * @param  {String}  name      The name of the lock
     *
     * @return Promise
     */
  var _unlock = function(name) {
    logger.debug("Release the lock '" + name + "'");

    return _sync().then(function() {
      return Lock.destroy({
        where: {
          id: name
        }
      });
    });
  };

  return {
    /**
         * Acquire a lock, execute the specified callback and release the lock.
         *
         * @param  {String}   name              The name of the lock to acquire
         * @param  {Function} callback          The callback to execute
         * @param  {Object}   options           See below for details description
         * @param  {Integer}  options.attempt   The number of attempt to acquire a lock. Default value: 1.
         * @param  {Integer}  options.delay     The delay between 2 attempts. Default value: 500ms.
         * @param  {Integer}  options.timeout   The number of seconds where the lock is considered as expired. Default value: 600s.
         *
         * @return Promise
         */
    doWithLock: function(name, callback, options) {
      var hasLock = false;
      return _lock(name, options)
        .then(function() {
          hasLock = true;
          return callback();
        })
        .finally(function() {
          if (hasLock) {
            return _unlock(name);
          }
        });
    },

    /**
         * Acquire a lock with the specified name.
         *
         * @param  {String}   name              The name of the lock to acquire
         * @param  {Object}   options           See below for details description
         * @param  {Integer}  options.attempt   The number of attempt to acquire a lock. Default value: 1.
         * @param  {Integer}  options.delay     The delay between 2 attempts. Default value: 500ms.
         * @param  {Integer}  options.timeout   The number of seconds where the lock is considered as expired. Default value: 600s.
         *
         * @return Promise
         */
    lock: function(name, options) {
      return _lock(name, options);
    },

    /**
         * Release the lock with the specified name.
         *
         * @param  {String}   name     The name of the lock to release
         *
         * @return Promise
         */
    unlock: function(name) {
      return _unlock(name);
    }
  };
};
