var _ = require("lodash");
// var logger = require("node-tech-logger");
// var techRuuid = require("node-tech-ruuid");
// var techTime = require("node-tech-time");

/**
 * Wrap a sequelize function so that it emits its duration.
 *
 * @param options.sequelize
 *        {Sequelize}
 * @param options.entityName
 *        {String} should be the name of a Sequelize entity
 * @param options.emitter
 *        {EventEmitter} will emit 'sql' events with an object like :
 *
 *        {
 *            entityName : "Accounts",
 *            fnName : "findAll",
 *            sqlQuery : "SELECT ... ",
 *            duration : {
 *               ms : 6.78,
 *               ns : 6775874
 *            }
 *        }
 */
module.exports = function wrapSql(options) {

    var sequelize = options.sequelize,
        entityName = options.entityName;
    // emitter = options.emitter;

    var model = sequelize.model(entityName);

    function wrapSqlFn(ruuid, promiseFn, category) {
        return promiseFn();
    }

    // TODO [JLE] Finish migration to Sequelize v3.x to include back duration/performance logging
    // function wrapSqlFn(ruuid, promiseFn, category) {
    //     techRuuid.check(ruuid);
    //     var start = techTime.start();
    //     var promise = promiseFn();
    //     var sqlCb = function(query) {
    //         emitter.emit("sql", {
    //             category: category,
    //             ruuid: ruuid || "unknown",
    //             entityName: entityName,
    //             sqlQuery: query,
    //             duration: techTime.end(start)
    //         });
    //     };
    //     promise.on("sql", sqlCb).catch(function(error) {
    //         logger.error("Error running Sql", error);
    //     });
    //     return promise;
    // }

    function wrapByName(fnName, category) {
        var wrappedFunction = function wrappedFunction() {
            var ruuid = _.head(arguments);
            var originalFnArgs = _.tail(arguments);
            var originalFn = model[fnName];

            return wrapSqlFn(ruuid, function() {
                return originalFn.apply(model, originalFnArgs);
            }, category);

        };
        return wrappedFunction;
    }

    function wrapUpdate() {
        return function wrappedUpdate(ruuid, entity, attributes) {
            return wrapSqlFn(ruuid, function() {
                return entity.updateAttributes(attributes);
            }, "Update");
        };
    }

    return {
        wrapByName: wrapByName,
        wrapUpdate: wrapUpdate
    };
};
