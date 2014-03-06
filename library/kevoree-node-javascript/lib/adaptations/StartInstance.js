var AdaptationPrimitive = require('./AdaptationPrimitive'),
    kevoree             = require('kevoree-library').org.kevoree,
    StopInstance        = require('./StopInstance');

var factory = new kevoree.impl.DefaultKevoreeFactory();

module.exports = AdaptationPrimitive.extend({
    toString: 'StartInstance',

    execute: function (_super, callback) {
        _super.call(this, callback);

        if (this.modelElement.name != this.node.getName() && this.isRelatedToPlatform(this.modelElement)) {
            var instance = this.mapper.getObject(this.modelElement.path());

            if (instance != undefined && instance != null) {
                // check dictionary value and give default values if none set
                var dicType = this.modelElement.typeDefinition.dictionaryType;
                if (dicType) {
                    var attrs = dicType.attributes.iterator();
                    while (attrs.hasNext()) {
                        var attr = attrs.next();
                        var val = instance.dictionary.getValue(attr.name);
                        if (!val) instance.dictionary.setEntry(attr.name, attr.defaultValue);
                    }
                }

                instance.start();
                this.log.debug(this.toString(), 'job done for '+instance.getName()+'@'+this.node.getName());
                return callback();

            } else {
                return callback(new Error(this.toString()+" error: unable to start instance "+this.modelElement.name));
            }
        }

        return callback();
    },

    undo: function (_super, callback) {
        _super.call(this, callback);

        var cmd = new StopInstance(this.node, this.mapper, this.adaptModel, this.modelElement);
        cmd.execute(callback);

        return;
    }
});