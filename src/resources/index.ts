import {FrameworkConfiguration} from 'aurelia-framework';

export function configure(config: FrameworkConfiguration) {
  config.globalResources([
    './elements/aurelia-logo.html',
    './elements/debug-expander',
    './elements/controller-view.html',
    './elements/property-view.html'
  ]);
}
