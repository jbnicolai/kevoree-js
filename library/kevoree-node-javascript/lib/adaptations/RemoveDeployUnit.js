var AdaptationPrimitive = require('kevoree-entities').AdaptationPrimitive,
    AddDeployUnit       = require('./AddDeployUnit');

/**
 * RemoveDeployUnit Adaptation
 *
 * @type {RemoveDeployUnit} extend AdaptationPrimitive
 */
module.exports = AdaptationPrimitive.extend({
    toString: 'RemoveDeployUnit',

    execute: function (_super, callback) {
        _super.call(this, callback);

        if (this.modelElement) {
            var bootstrapper = this.node.getKevoreeCore().getBootstrapper();
            return bootstrapper.uninstall(this.modelElement, function (err) {
                if (err) {
                    return callback(err);
                }

                this.log.debug(this.toString(), this.modelElement.path());
                this.mapper.removeEntry(this.modelElement.path());
                callback();
            }.bind(this));
        }

        return callback();
    },

    undo: function (_super, callback) {
        _super.call(this, callback);

        var cmd = new AddDeployUnit(this.node, this.mapper, this.adaptModel, this.modelElement);
        cmd.execute(callback);
    }
});