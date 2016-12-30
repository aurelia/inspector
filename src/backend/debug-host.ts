import {autoinject} from 'aurelia-dependency-injection';

declare var $0: any;

var processSelection = function () {
  function setValue(debugInfo, value) {
    let type;
    let debugValue;

    if (value instanceof Node) {
      debugInfo.type = 'node';
      debugInfo.value = '[node]';
    } else if (Array.isArray(value)) {
      debugInfo.canExpand = true;
      debugInfo.type = 'array';
      debugInfo.value = '[array]';
    } else {
      debugInfo.type = typeof value;
      debugInfo.value = value;
    }

    if (debugInfo.type === 'object') {
      debugInfo.canExpand = true;

      if (value.constructor) {
        debugInfo.value = value.constructor.name;
      } else {
        debugInfo.value = '[object]';
      }
    }

    return debugInfo;
  }

  function createControllerDebugInfo(controller) {
    try {
      let controllerDebugInfo: any = {
        name: controller.behavior.elementName || controller.behavior.attributeName
      };
      
      let viewModel = controller.viewModel;

      controllerDebugInfo.bindables = controller.behavior.properties.map(x => {
        return setValue({
          name: x.name,
          attribute: x.attribute,
        }, viewModel[x.name]);
      });

      controllerDebugInfo.properties = Object.keys(viewModel).filter(x => {
        let found = controllerDebugInfo.bindables.find(x => x.name === x);
        return !found && !x.startsWith('_');
      }).map(x => {
        return setValue({
          name: x
        }, viewModel[x]);
      });

      return controllerDebugInfo;
    } catch (e) {
      return e.message;
    }
  }

  function _getRepeaterContext(node) {
    var current = node.nextSibling;

    while (current) {
      if (current.nodeType === 8 && current.viewSlot) {
        var children = current.viewSlot.children;

        for (var i = 0, ii = children.length; i < ii; ++i) {
          var view = children[i];
          var currentChild = view.firstChild
          var lastChild = view.lastChild;
          var nextChild;

          while (currentChild) {
            nextChild = currentChild.nextSibling;

            if (currentChild === node) {
              return view.bindingContext;
            }

            if (currentChild === lastChild) {
              break;
            }

            currentChild = nextChild;
          }
        }
      }

      current = current.nextSibling;
    }

    return null;
  }

  function _getBindingContext(node) {
    if (!node) {
      return null;
    }

    if (node.aurelia) {
      return node.aurelia.root.viewModel;
    } else if (node.au) {
      var au = node.au;

      if (au.controller) { //custom element
        var controller = au.controller;
        var tagName = node.tagName ? node.tagName.toLowerCase() : null;
        var repeaterContext;

        if (tagName === 'router-view') {
          return controller.viewModel.view.controller.viewModel;
        } else if (tagName === 'compose') {
          return controller.viewModel.currentViewModel;
        } else if (controller['with']) {
          return controller['with'].viewModel.value;
        } else if (repeaterContext = _getRepeaterContext(node)) {
          return repeaterContext;
        } else {

        }
      }
    }

    return _getBindingContext(node.parentNode);
  }

  function getBindingContext(node) {
    var repeaterContext;

    if (repeaterContext = _getRepeaterContext(node)) {
      return repeaterContext;
    }

    return _getBindingContext(node.parentNode);
  }

  function convertObjectToDebugInfo(obj) {
    return {
      properties: Object.keys(obj).map(x => {
        return setValue({
          name: x
        }, obj[x]);
      })
    };
  }

  var selectedNode = $0;
  var debugInfo: any = {};

  if (selectedNode.au) {
    var au = selectedNode.au;

    if (au.controller) {
      debugInfo.customElement = createControllerDebugInfo(au.controller);
    }

    var tagName = selectedNode.tagName ? selectedNode.tagName.toLowerCase() : null;
    var customAttributeNames = Object.keys(au).filter(function (key) {
      return key !== 'controller' && key !== tagName;
    });

    if (customAttributeNames.length) {
      debugInfo.customAttributes = customAttributeNames.map(x => createControllerDebugInfo(au[x]));
    }
  }

  debugInfo.bindingContext = convertObjectToDebugInfo(getBindingContext(selectedNode));

  return debugInfo;
};

export class SelectionChanged {
  constructor(public debugInfo) {}
}

export interface IHostConsumer {
  onSelectionChanged(event: SelectionChanged);
}

@autoinject
export class DebugHost {
  attach(consumer: IHostConsumer) {
    let code = "(" + processSelection.toString() + ")()";
    
    chrome.devtools.panels.elements.onSelectionChanged.addListener(() => {
      chrome.devtools.inspectedWindow.eval(code, debugObject => {
        consumer.onSelectionChanged(new SelectionChanged(debugObject))
      });
    });

    chrome.devtools.inspectedWindow.eval(code, debugObject => {
      consumer.onSelectionChanged(new SelectionChanged(debugObject))
    });
  }
}
