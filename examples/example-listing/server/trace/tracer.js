

const binding = process.binding('trace_events');
const trace = require('trace_events');

const BEGIN = 0x042; 
const END = 0x045;
const META = 0x04d;
const ABEGIN = 0x062;
const AEND = 0x065;
const AINSTANT = 0x06e;

class Tracer {
  constructor(name) {
    this._name = name;
    this._tracer = trace.createTracing({ categories: [name] });
    this._traces = 0;
  }

  get name() {
    return this._name;
  }

  enable() {
    this._tracer.enable();
  }

  disable() {
    this._tracer.disable();
  }

  createTrace() {
    this._traces += 1;
    return new Trace(this);
  }
}

class Trace {
  constructor(tracer) {
    this._tracer = tracer;
    this._id = tracer._traces;
  }

  timeBegin(tag, ...args) {
    binding.emit(BEGIN, this._tracer.name, tag, this._id, ...args);
  }

  timeEnd(tag, ...args) {
    binding.emit(END, this._tracer.name, tag, this._id, ...args);
  }

  asyncBegin(tag, ...args) {
    binding.emit(ABEGIN, this._tracer.name, tag, this._id, ...args);
  }

  asyncEvent(tag, ...args) {
    binding.emit(AINSTANT, this._tracer.name, tag, this._id, ...args);
  }

  asyncEnd(tag, ...args) {
    binding.emit(AEND, this._tracer.name, tag, this._id, ...args);
  }
}

module.exports = Tracer;