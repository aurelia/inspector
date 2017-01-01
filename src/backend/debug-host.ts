import { autoinject } from 'aurelia-dependency-injection';

declare var aureliaDebugger;

var createAureliaDebugger = function () {
  function createErrorObject(e) {
    return {
      bindingContext: {
        properties: [
          {
            name: 'Error',
            value: e.message,
            type: 'string'
          }
        ]
      }
    }
  }

  function nodeIsImmediateChildOfView(view, node) {
    let currentChild = view.firstChild
    let lastChild = view.lastChild;
    let nextChild;

    while (currentChild) {
      nextChild = currentChild.nextSibling;

      if (currentChild === node) {
        return true;
      }

      if (currentChild === lastChild) {
        break;
      }

      currentChild = nextChild;
    }

    return false;
  }

  function findSiblingRepeaterView(node) {
    if (!node) {
      return null;
    }

    let current = node.nextSibling;

    while (current) {
      if (current.nodeType === 8 && current.viewSlot) {
        let children = current.viewSlot.children;

        for (let i = 0, ii = children.length; i < ii; ++i) {
          let view = children[i];

          if (nodeIsImmediateChildOfView(view, node)) {
            return view;
          }
        }
      }

      current = current.nextSibling;
    }

    return null;
  }

  function findImmediateControllerOwningView(node) {
    let parent = node.parentNode;

    if (parent && parent.au && parent.au.controller
      && parent.au.controller.view && nodeIsImmediateChildOfView(parent.au.controller.view, node)) {
      return parent.au.controller.view;
    }

    return null;
  }

  function findComposingView(node) {
    if (!node) {
      return null;
    }

    if (node.aurelia) {
      return node.aurelia.root.view;
    } else if (node.auOwnerView) {
      return node.auOwnerView;
    } else if (node.au) {
      var au = node.au;

      if (au.controller) { //custom element
        var controller = au.controller;
        var tagName = node.tagName ? node.tagName.toLowerCase() : null;

        if (tagName === 'router-view') {
          return controller.viewModel.view;
        } else if (tagName === 'compose') {
          return controller.viewModel.currentController.view;
        }
      } else if (controller['with']) {
        return controller['with'].viewModel.view;
      }
    }

    return null;
  }

  function getDebugPropertyKeys(obj) {
    let props = [];

    for (let key in obj) {
      if (!key.startsWith('_') && typeof obj[key] !== 'function') {
        props.push(key);
      }
    }

    return props;
  }

  window['aureliaDebugger'] = {
    setValueOnDebugInfo(debugInfo, value) {
      let type;
      let debugValue;

      if (value instanceof Node) {
        debugInfo.canExpand = true;
        debugInfo.type = 'node';
        debugInfo.value = value.constructor.name;
        debugInfo.debugId = this.getNextDebugId();
        this.debugValueLookup[debugInfo.debugId] = value;
      } else if (Array.isArray(value)) {
        debugInfo.canExpand = true;
        debugInfo.type = 'array';
        debugInfo.value = `Array[${value.length}]`;
        debugInfo.debugId = this.getNextDebugId();
        this.debugValueLookup[debugInfo.debugId] = value;
      } else {
        debugInfo.type = typeof value;
        debugInfo.value = value;
      }

      if (value === null) {
        //do nothing
      } else if (value === undefined) {
        //do nothing
      } else if (debugInfo.type === 'object') {
        debugInfo.canExpand = true;
        debugInfo.debugId = this.getNextDebugId();
        this.debugValueLookup[debugInfo.debugId] = value;

        if (value.constructor) {
          debugInfo.value = value.constructor.name;
        } else {
          debugInfo.value = 'Object';
        }
      } else if (debugInfo.type === 'function') {
        return null;
      }

      return debugInfo;
    },
    createControllerDebugInfo(controller) {
      try {
        let controllerDebugInfo: any = {
          name: controller.behavior.elementName || controller.behavior.attributeName
        };

        let viewModel = controller.viewModel;
        let bindableKeys = {};

        controllerDebugInfo.bindables = controller.behavior.properties.map(x => {
          bindableKeys[x.name] = true;
          return this.setValueOnDebugInfo({
            name: x.name,
            attribute: x.attribute,
          }, viewModel[x.name]);
        });

        controllerDebugInfo.properties = getDebugPropertyKeys(viewModel)
          .filter(x => !(x in bindableKeys))
          .map(x => {
            return this.setValueOnDebugInfo({
              name: x
            }, viewModel[x]);
          });

        return controllerDebugInfo;
      } catch (e) {
        return createErrorObject(e);
      }
    },
    convertObjectToDebugInfo(obj, blackList) {
      blackList = blackList || {};
      return {
        properties: getDebugPropertyKeys(obj)
          .filter(x => !(x in blackList))
          .map(x => {
            return this.setValueOnDebugInfo({
              name: x
            }, obj[x]);
          })
      };
    },
    selectNode(selectedNode) {
      try {
        var debugInfo: any = {};

        this.debugValueLookup = {};
        this.nextDebugId = 0;

        if (selectedNode.au) {
          var au = selectedNode.au;

          if (au.controller) {
            debugInfo.customElement = this.createControllerDebugInfo(au.controller);
          }

          var tagName = selectedNode.tagName ? selectedNode.tagName.toLowerCase() : null;
          var customAttributeNames = getDebugPropertyKeys(au)
            .filter(function (key) {
              return key !== 'controller' && key !== tagName;
            });

          if (customAttributeNames.length) {
            debugInfo.customAttributes = customAttributeNames.map(x => this.createControllerDebugInfo(au[x]));
          }
        }

        let owningView = this.findOwningViewOfNode(selectedNode);

        if (owningView) {
          if (owningView.bindingContext) {
            debugInfo.bindingContext = this.convertObjectToDebugInfo(owningView.bindingContext);
          }

          if (owningView.overrideContext) {
            debugInfo.overrideContext = this.convertObjectToDebugInfo(
              owningView.overrideContext,
              { bindingContext: true, parentOverrideContext: true }
              );
          }
        }

        return debugInfo;
      } catch (e) {
        return createErrorObject(e);
      }
    },
    getNextDebugId() {
      return ++this.nextDebugId;
    },
    expandDebugValue(id) {
      let value = this.debugValueLookup[id];

      if (Array.isArray(value)) {
        let newValue = {};
        value.forEach((value, index) => {
          newValue[index] = value
        });
        value = newValue;
      }

      let debugInfo = this.convertObjectToDebugInfo(value);
      return debugInfo;
    },
    findOwningViewOfNode(node) {
      function moveUp(n) {
        let current = n.parentNode;

        if (current) {
          return findComposingView(current) || findSiblingRepeaterView(current) || findImmediateControllerOwningView(current) || moveUp(current);
        }

        return null;
      }

      return node.auOwnerView || findSiblingRepeaterView(node) || findImmediateControllerOwningView(node) || moveUp(node);
    }
  }
}

export class SelectionChanged {
  constructor(public debugInfo) { }
}

export interface IHostConsumer {
  onSelectionChanged(event: SelectionChanged);
}

@autoinject
export class DebugHost {
  test = {
    foo: 'message',
    bar: {
      something: 'sdfsdfsdfsdf',
      someArray: [
        {
          a: 'thing'
        },
        {
          b: 'or two'
        }
      ]
    }
  };

  attach(consumer: IHostConsumer) {
    if (chrome && chrome.devtools) {
      chrome.devtools.inspectedWindow.eval("(" + createAureliaDebugger.toString() + ")()", () => {
        var code = "aureliaDebugger.selectNode($0)";

        chrome.devtools.panels.elements.onSelectionChanged.addListener(() => {
          chrome.devtools.inspectedWindow.eval(code, debugObject => {
            consumer.onSelectionChanged(new SelectionChanged(debugObject))
          });
        });

        chrome.devtools.inspectedWindow.eval(code, debugObject => {
          consumer.onSelectionChanged(new SelectionChanged(debugObject))
        });
      });
    }
  }

  toggleDebugValueExpansion(debugValue) {
    if (debugValue.canExpand) {
      debugValue.isExpanded = !debugValue.isExpanded;

      if (debugValue.isExpanded && !debugValue.expandedValue) {
        let code = "aureliaDebugger.expandDebugValue(" + debugValue.debugId + ");";

        chrome.devtools.inspectedWindow.eval(code, expandedValue => {
          debugValue.expandedValue = expandedValue;
          debugValue.isExpanded = true;
        });
      }
    }
  }
}
