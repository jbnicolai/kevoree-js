var AbstractNode        = require('kevoree-entities').AbstractNode,
    KevoreeLogger       = require('kevoree-commons').KevoreeLogger,
    AdaptationEngine    = require('./AdaptationEngine'),
    kevoree             = require('kevoree-library').org.kevoree,
    async               = require('async');

var JavascriptNode = AbstractNode.extend({
    toString: 'JavascriptNode',

    dic_logLevel: {
        defaultValue: 'DEBUG',
        optional: false,
        update: function (value) {
            switch (value.toLowerCase().trim()) {
                case 'all':
                    this.log.setLevel(KevoreeLogger.ALL);
                    break;

                default:
                case 'debug':
                    this.log.setLevel(KevoreeLogger.DEBUG);
                    break;

                case 'info':
                    this.log.setLevel(KevoreeLogger.INFO);
                    break;

                case 'error':
                    this.log.setLevel(KevoreeLogger.ERROR);
                    break;

                case 'warn':
                    this.log.setLevel(KevoreeLogger.WARN);
                    break;
            }
        }
    },

    dic_logFilter: {
        optional: true,
        update: function (value) {
            this.log.setFilter(value);
        }
    },

    construct: function () {
        this.adaptationEngine = new AdaptationEngine(this);
    },

    start: function (_super) {
        _super.call(this);
        this.adaptationEngine.setLogger(this.getKevoreeCore().getLogger());
        var logLevel = this.dictionary.getValue('logLevel') || this.dic_logLevel.defaultValue;
        console.log('logLevel from dic', logLevel);
        switch (logLevel.toLowerCase().trim()) {
            case 'all':
                this.log.setLevel(KevoreeLogger.ALL);
                break;

            default:
            case 'debug':
                this.log.setLevel(KevoreeLogger.DEBUG);
                break;

            case 'info':
                this.log.setLevel(KevoreeLogger.INFO);
                break;

            case 'error':
                this.log.setLevel(KevoreeLogger.ERROR);
                break;

            case 'warn':
                this.log.setLevel(KevoreeLogger.WARN);
                break;
        }
    },

    stop: function (_super) {
        _super.call(this);
        // TODO improve that, this is not a "stop" this is a complete "destroy"
        // clone current model
        var cloner = new kevoree.cloner.DefaultModelCloner();
        var emptyNodeModel = cloner.clone(this.getKevoreeCore().getCurrentModel(), false);
        var node = emptyNodeModel.findNodesByID(this.getName());
        if (node) {
            // delete everything from cloned model that is related to this node
            node.delete();

            // re-add this "empty" node to the cloned model
            var factory = new kevoree.impl.DefaultKevoreeFactory();
            node = factory.createContainerNode();
            node.name = this.getName();

            // compare emptyNodeModel with currentModel in order to create primitives for this platform fragments stops
            var compare = new kevoree.compare.DefaultModelCompare();
            var diffSeq = compare.diff(this.getKevoreeCore().getCurrentModel(), emptyNodeModel);
            var primitives = this.processTraces(diffSeq, emptyNodeModel);

            function execPrimitive(primitive, cb) {
                primitive.execute(cb);
            }

            async.eachSeries(primitives, execPrimitive, function (err) {
                if (err) {
                    // something went wrong while stopping node
                    this.log.error(this.toString(), 'Something went wrong while stopping '+this.getName());
                }
            }.bind(this));
        }
    },

    /**
     * Process traces in order to do the adaptation logic on the current node
     * @param diffSeq diff traces generated by comparing current KevoreeCore model and given model
     * @param targetModel toDeploy model used by KevoreeCore to generate the trace
     * @returns {Array}
     */
    processTraces: function (diffSeq, targetModel) {
        return this.adaptationEngine.processTraces(diffSeq, targetModel);
    }
});

module.exports = JavascriptNode;