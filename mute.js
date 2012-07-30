var PT = require('readable-stream/passthrough.js')

module.exports = MuteStream

// var out = new MuteStream(process.stdout)
// argument auto-pipes
function MuteStream (opts) {
  console.error('muteStream', opts);
  PT.apply(this)
  opts = opts || {}
  this.muted = false
  this.on('pipe', this._onpipe)
  this.replace = opts.replace
}

MuteStream.prototype = Object.create(PT.prototype)

Object.defineProperty(MuteStream.prototype, 'constructor', {
  value: MuteStream,
  enumerable: false
})

MuteStream.prototype.mute = function () {
  console.error('mutestream mute');
  this.muted = true
}

MuteStream.prototype.unmute = function () {
  console.error('mutestream unmute');
  this.muted = false
}

Object.defineProperty(MuteStream.prototype, '_onpipe', {
  value: onPipe,
  enumerable: false,
  writable: true,
  configurable: true
})

function onPipe (src) {
  this._src = src
}

Object.defineProperty(MuteStream.prototype, 'isTTY', {
  get: getIsTTY,
  set: setIsTTY,
  enumerable: true,
  configurable: true
})

function getIsTTY () {
  return( (this._dest) ? this._dest.isTTY
        : (this._src) ? this._src.isTTY
        : false
        )
}

// basically just get replace the getter/setter with a regular value
function setIsTTY (isTTY) {
  Object.defineProperty(this, 'isTTY', {
    value: isTTY,
    enumerable: true,
    writable: true,
    configurable: true
  })
}

MuteStream.prototype.pipe = function (dest) {
  console.error('mutestream pipe');
  this._dest = dest
  return PT.prototype.pipe.call(this, dest)
}

MuteStream.prototype.transform = function(c) {
  console.error('mutestream transform', c)
  if (this.muted) {
    if (!this.replace) return null
    c = c.toString().replace(/./g, this.replace)
  }
  return c
}
