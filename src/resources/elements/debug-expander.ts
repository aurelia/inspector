import {bindable} from 'aurelia-templating';

export class DebugExpander {
  @bindable heading: string;
  isExpanded: boolean = true;
}
