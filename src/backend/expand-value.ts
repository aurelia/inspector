import {autoinject} from 'aurelia-dependency-injection';
import {DebugHost} from './debug-host';

@autoinject
export class DebugHostViewEngineHooks {
  constructor(private debugHost: DebugHost) {}

  beforeBind(view) {
    view.overrideContext.toggleDebugValueExpansion = debugValue => this.debugHost.toggleDebugValueExpansion(debugValue);
  }
}
