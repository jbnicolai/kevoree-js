var AbstractNode = require('kevoree-entities').AbstractNode;
var kevoree = require('kevoree-library').org.kevoree;
var genDictionary = require('./genDictionary');

/**
 * Generates channel
 * @param deployUnit
 * @param obj
 * @param model
 */
module.exports = function (deployUnit, obj, model) {
  console.log('genNode', deployUnit.name, obj);
  var factory = new kevoree.impl.DefaultKevoreeFactory();

  // create a new group type
  var nodeType = factory.createNodeType();
  nodeType.name = obj.toString();

  // add super type if not AbstractGroup
  var superType = obj.constructor.prototype.superPrototype.toString();
  if (superType != 'AbstractNode') {
    // TODO
  }

  // set deployUnit
  nodeType.deployUnit = deployUnit;

  // add dictionary
  genDictionary(nodeType, obj);

  model.addTypeDefinitions(nodeType);

  return nodeType;
}