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
module.exports = ({ sequelize, entityName }) => {
  const model = sequelize.model(entityName);

  const wrapSqlFn = (ruuid, promiseFn) => promiseFn();

  const wrapByName = fnName => {
    const wrappedFunction = (ruuid, ...originalFnArgs) => {
      const originalFn = model[fnName];
      return wrapSqlFn(ruuid, () => originalFn.apply(model, originalFnArgs));
    };
    return wrappedFunction;
  };

  const wrapUpdate = () => (ruuid, entity, attributes) => wrapSqlFn(ruuid, () => entity.updateAttributes(attributes));

  return { wrapByName, wrapUpdate };
};
