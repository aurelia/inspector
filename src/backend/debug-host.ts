import { autoinject } from 'aurelia-dependency-injection';

declare var aureliaDebugger;

var createAureliaDebugger = function () {
  if (window['aureliaDebugger']) {
    return;
  }

  (function () {
    let nextDebugId = 0;

    function getNextDebugId() {
      return ++nextDebugId;
    }

    function createErrorObject(e) {
      return {
        bindingContext: {
          properties: [
            {
              name: 'Debugger Error',
              value: e.message,
              type: 'string',
              canEdit: false
            }
          ]
        }
      }
    }

    function attachedOwner(node) {
      let ownerView = node.auOwnerView;

      if (ownerView && ownerView.viewFactory) {
        return ownerView;
      }

      return null;
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
        if (current.nodeType === 8 && current.viewSlot && current.data === 'anchor') {
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
      } else if (attachedOwner(node)) {
        return attachedOwner(node);
      } else if (node.au) {
        var au = node.au;

        if (au.controller) { //custom element
          var controller = au.controller;
          var tagName = node.tagName ? node.tagName.toLowerCase() : null;

          if (tagName === 'router-view') {
            return controller.viewModel.view;
          } else if (tagName === 'compose') {
            return controller.viewModel.currentController.view;
          } else if (controller['with']) {
            return controller['with'].viewModel.view;
          }
        }
      }

      return null;
    }

    function getDebugPropertyKeys(obj) {
      let props = [];
      
      const keys = [...Object.keys(obj), ...Object.getOwnPropertyNames(obj)];

      for (const key of keys) {
        if (key && !key.startsWith('_') && typeof obj[key] !== 'function') {
          props.push(key);
        }
      }

      return props;
    }

    window['aureliaDebugger'] = {
      setValueOnDebugInfo(debugInfo, value, instance) {
        try {
          let expandableValue:any;

          if (value instanceof Node) {
            debugInfo.canExpand = true;
            debugInfo.type = 'node';
            debugInfo.value = value.constructor.name;
            expandableValue = value;
          } else if (Array.isArray(value)) {
            debugInfo.canExpand = true;
            debugInfo.type = 'array';
            debugInfo.value = `Array[${value.length}]`;
            expandableValue = value;
          } else {
            debugInfo.type = typeof value;
            debugInfo.value = value;
          }

          if (value === null) {
            debugInfo.type = 'null';
            debugInfo.value = 'null';
          } else if (value === undefined) {
            debugInfo.type = 'undefined';
            debugInfo.value = 'undefined';
          } else if (debugInfo.type === 'object') {
            debugInfo.canExpand = true;
            expandableValue = value;

            if (value.constructor) {
              debugInfo.value = value.constructor.name;
            } else {
              debugInfo.value = 'Object';
            }
          }

          if (debugInfo.type === 'string' || debugInfo.type === 'number' || debugInfo.type === 'boolean') {
            debugInfo.canEdit = true;
          }

          debugInfo.debugId = debugInfo.debugId || getNextDebugId();

          this.debugValueLookup[debugInfo.debugId] = Object.assign({
            instance: instance,
            expandableValue: expandableValue
          }, debugInfo);

          return debugInfo;
        } catch(e) {
          return createErrorObject(e);
        }
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
            }, viewModel[x.name], viewModel);
          });

          controllerDebugInfo.properties = getDebugPropertyKeys(viewModel)
            .filter(x => !(x in bindableKeys))
            .map(x => {
              return this.setValueOnDebugInfo({
                name: x
              }, viewModel[x], viewModel);
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
              }, obj[x], obj);
            })
        };
      },
      getDebugInfoForNode(selectedNode) {
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
      getExpandedDebugValueForId(id) {
        let value = this.debugValueLookup[id].expandableValue;

        if (Array.isArray(value)) {
          let newValue = {};
          value.forEach((value, index) => {
            newValue[index] = value
          });
          value = newValue;
        }

        return this.convertObjectToDebugInfo(value);
      },
      findOwningViewOfNode(node) {
        function moveUp(n) {
          let current = n.parentNode;

          if (current) {
            return findComposingView(current) || findSiblingRepeaterView(current) || findImmediateControllerOwningView(current) || moveUp(current);
          }

          return null;
        }

        return attachedOwner(node) || findSiblingRepeaterView(node) || findImmediateControllerOwningView(node) || moveUp(node);
      },
      updateValueForId(id, value) {
        let debugInfo = this.debugValueLookup[id];
        debugInfo.instance[debugInfo.name] = value;
        this.setValueOnDebugInfo(debugInfo, value, debugInfo.instance);
      }
    }
  })();
}

export class SelectionChanged {
  constructor(public debugInfo) { }
}

export interface IHostConsumer {
  onSelectionChanged(event: SelectionChanged);
}

@autoinject
export class DebugHost {
  attach(consumer: IHostConsumer) {
    if (chrome && chrome.devtools) {
      var code = "(" + createAureliaDebugger.toString() + ")(); aureliaDebugger.getDebugInfoForNode($0)";

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

  updateDebugValue(debugInfo) {
    let value = debugInfo.value;

    if (debugInfo.type === 'string') {
      value = "'" + value + "'";
    }

    let code = `aureliaDebugger.updateValueForId(${debugInfo.debugId}, ${value})`;
    chrome.devtools.inspectedWindow.eval(code);
  }

  toggleDebugValueExpansion(debugInfo) {
    if (debugInfo.canExpand) {
      debugInfo.isExpanded = !debugInfo.isExpanded;

      if (debugInfo.isExpanded && !debugInfo.expandedValue) {
        let code = `aureliaDebugger.getExpandedDebugValueForId(${debugInfo.debugId});`;

        chrome.devtools.inspectedWindow.eval(code, expandedValue => {
          debugInfo.expandedValue = expandedValue;
          debugInfo.isExpanded = true;
        });
      }
    }
  }
}
