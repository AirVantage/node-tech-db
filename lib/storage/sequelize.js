var redefine = require("redefine");

/**
 * Umzug storage using sequelize in order to create/delete the migration files.
 *
 * [constructor description]
 * @param  {Object} options                              Umzug configuration
 * @param  {Object} options.storageOptions               Storage options. See below for more details
 * @param  {Object} options.storageOptions.sequelize     Sequelize instance
 * @param  {Object} options.storageOptions.Sequelize     Reference to sequelize module
 */
module.exports = redefine.Class({
    constructor: function(options) {
        this.options = options || {};
        this.options.storageOptions = this.options.storageOptions || {};

        if (!this.options.storageOptions.sequelize) {
            throw new Error("Storage option \"sequelize\" is required");
        }

        if (!this.options.storageOptions.Sequelize) {
            throw new Error("Storage option \"Sequelize\" is required");
        }

        // initialize model
        var sequelize = this.options.storageOptions.sequelize;
        var Sequelize = this.options.storageOptions.Sequelize;

        this.options.storageOptions.model = sequelize.define("MigrationFile", {
            migration: {
                type: Sequelize.STRING(255),
                primaryKey: true,
                allowNull: false
            }
        }, {
            // Add the column 'createdAt'
            timestamps: true,
            updatedAt: false
        });
    },

    logMigration: function(migrationName) {
        return this._model()
            .sync()
            .bind(this)
            .then(function(Model) {
                return Model.create({
                    migration: migrationName
                });
            });
    },

    unlogMigration: function(migrationName) {
        return this._model()
            .sync()
            .bind(this)
            .then(function(Model) {
                return Model.destroy({
                    where: {
                        migration: migrationName
                    }
                });
            });
    },

    executed: function() {
        return this._model()
            .sync()
            .bind(this)
            .then(function(Model) {
                return Model.findAll();
            })
            .then(function(migrations) {
                return migrations.map(function(migration) {
                    return migration.migration;
                }.bind(this));
            });
    },

    _model: function() {
        return this.options.storageOptions.model;
    }
});
