var AdaptationPrimitive = require('./AdaptationPrimitive'),
    AddBinding          = require('./AddBinding');

module.exports = AdaptationPrimitive.extend({
    toString: 'RemoveBinding',

    execute: function (_super, callback) {
        _super.call(this, callback);

        var chanInstance = this.mapper.getObject(this.modelElement.hub.path()),
            compInstance = this.mapper.getObject(this.modelElement.port.eContainer().path()),
            portInstance = this.mapper.getObject(this.modelElement.port.path());

        if (chanInstance && compInstance) {
            var provided = this.modelElement.port.eContainer().findProvidedByID(this.modelElement.port.name);
            if (provided) {
                this.log.debug(this.toString(), 'input '+portInstance.getPath()+' <-> '+chanInstance.getPath());
                compInstance.removeInternalInputPort(portInstance);
                chanInstance.removeInternalInputPort(portInstance);
            } else {
                this.log.debug(this.toString(), 'output '+portInstance.getPath()+' <-> '+chanInstance.getPath());
                compInstance.removeInternalOutputPort(portInstance);
            }
            return callback();
        }

        return callback();
    },

    undo: function (_super, callback) {
        _super.call(this, callback);

        var cmd = new AddBinding(this.node, this.mapper, this.adaptModel, this.modelElement);
        cmd.execute(callback);
    },

    isInputPortType: function (kPort) {
        var kCompTD = kPort.eContainer().typeDefinition;
        var inputs = kCompTD.provided ? kCompTD.provided.iterator() : null;
        if (inputs) {
            while (inputs.hasNext()) {
                var input = inputs.next();
                if (input.name == kPort.name) return true;
            }
        }

        var outputs = kCompTD.required ? kCompTD.required.iterator() : null;
        if (outputs) {
            while (outputs.hasNext()) {
                var output = outputs.next();
                if (output.name == kPort.name) return false;
            }
        }

        return false;
    }
});