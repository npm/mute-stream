const Stream = require('stream')
const { test } = require('node:test')
const assert = require('node:assert')
const MS = require('../')

// some marker objects
var END = {}
var PAUSE = {}
var RESUME = {}

class PassThrough extends Stream {
  constructor (opts) {
    super(opts)
    this.readable = this.writable = true
  }

  write (c) {
    this.emit('data', c)
    return true
  }

  end (c) {
    if (c) {
      this.write(c)
    }
    this.emit('end')
  }

  pause () {
    this.emit('pause')
  }

  resume () {
    this.emit('resume')
  }
}

test('incoming', function (t, done) {
  var ms = new MS()
  var str = new PassThrough()
  str.pipe(ms)

  var expect = ['foo', 'boo', END]
  ms.on('data', function (c) {
    assert.strictEqual(c, expect.shift())
  })
  ms.on('end', function () {
    assert.strictEqual(END, expect.shift())
    done()
  })
  str.write('foo')
  ms.mute()
  str.write('bar')
  ms.unmute()
  str.write('boo')
  ms.mute()
  str.write('blaz')
  str.end('grelb')
})

test('outgoing', function (t, done) {
  var ms = new MS()
  var str = new PassThrough()
  ms.pipe(str)

  var expect = ['foo', 'boo', END]
  str.on('data', function (c) {
    assert.strictEqual(c, expect.shift())
  })
  str.on('end', function () {
    assert.strictEqual(END, expect.shift())
    done()
  })

  ms.write('foo')
  ms.mute()
  ms.write('bar')
  ms.unmute()
  ms.write('boo')
  ms.mute()
  ms.write('blaz')
  ms.end('grelb')
})

test('isTTY', function () {
  var str = new PassThrough()
  str.isTTY = true
  str.columns = 80
  str.rows = 24

  var ms = new MS()
  assert.strictEqual(ms.isTTY, false)
  assert.strictEqual(ms.columns, undefined)
  assert.strictEqual(ms.rows, undefined)
  ms.pipe(str)
  assert.strictEqual(ms.isTTY, true)
  assert.strictEqual(ms.columns, 80)
  assert.strictEqual(ms.rows, 24)
  str.isTTY = false
  assert.strictEqual(ms.isTTY, false)
  assert.strictEqual(ms.columns, 80)
  assert.strictEqual(ms.rows, 24)
  str.isTTY = true
  assert.strictEqual(ms.isTTY, true)
  assert.strictEqual(ms.columns, 80)
  assert.strictEqual(ms.rows, 24)
  ms.isTTY = false
  assert.strictEqual(ms.isTTY, false)
  assert.strictEqual(ms.columns, 80)
  assert.strictEqual(ms.rows, 24)

  ms = new MS()
  assert.strictEqual(ms.isTTY, false)
  str.pipe(ms)
  assert.strictEqual(ms.isTTY, true)
  str.isTTY = false
  assert.strictEqual(ms.isTTY, false)
  str.isTTY = true
  assert.strictEqual(ms.isTTY, true)
  ms.isTTY = false
  assert.strictEqual(ms.isTTY, false)
})

test('pause/resume incoming', function () {
  var str = new PassThrough()
  var ms = new MS()
  str.on('pause', function () {
    assert.strictEqual(PAUSE, expect.shift())
  })
  str.on('resume', function () {
    assert.strictEqual(RESUME, expect.shift())
  })
  var expect = [PAUSE, RESUME, PAUSE, RESUME]
  str.pipe(ms)
  ms.pause()
  ms.resume()
  ms.pause()
  ms.resume()
  assert.strictEqual(expect.length, 0, 'saw all events')
})

test('replace with *', function () {
  var str = new PassThrough()
  var ms = new MS({ replace: '*' })
  str.pipe(ms)
  var expect = ['foo', '*****', 'bar', '***', 'baz', 'boo', '**', '****']

  ms.on('data', function (c) {
    assert.strictEqual(c, expect.shift())
  })

  str.write('foo')
  ms.mute()
  str.write('12345')
  ms.unmute()
  str.write('bar')
  ms.mute()
  str.write('baz')
  ms.unmute()
  str.write('baz')
  str.write('boo')
  ms.mute()
  str.write('xy')
  str.write('xyzΩ')

  assert.strictEqual(expect.length, 0)
})

test('replace with ~YARG~', function () {
  var str = new PassThrough()
  var ms = new MS({ replace: '~YARG~' })
  str.pipe(ms)
  var expect = ['foo', '~YARG~~YARG~~YARG~~YARG~~YARG~', 'bar',
    '~YARG~~YARG~~YARG~', 'baz', 'boo', '~YARG~~YARG~',
    '~YARG~~YARG~~YARG~~YARG~']

  ms.on('data', function (c) {
    assert.strictEqual(c, expect.shift())
  })

  // also throw some unicode in there, just for good measure.
  str.write('foo')
  ms.mute()
  str.write('ΩΩ')
  ms.unmute()
  str.write('bar')
  ms.mute()
  str.write('Ω')
  ms.unmute()
  str.write('baz')
  str.write('boo')
  ms.mute()
  str.write('Ω')
  str.write('ΩΩ')

  assert.strictEqual(expect.length, 0)
})
test('proxy methods (destroy, destroySoon, close)', function () {
  // Test with _dest
  var destCalls = { destroy: 0, destroySoon: 0, close: 0 }
  var dest = new PassThrough()
  dest.destroy = function (...args) {
    destCalls.destroy++
    assert.deepStrictEqual(args, ['arg1', 'arg2'])
  }
  dest.destroySoon = function (...args) {
    destCalls.destroySoon++
    assert.deepStrictEqual(args, ['arg3'])
  }
  dest.close = function (...args) {
    destCalls.close++
    assert.deepStrictEqual(args, [])
  }

  var ms = new MS()
  ms.pipe(dest)

  ms.destroy('arg1', 'arg2')
  assert.strictEqual(destCalls.destroy, 1)

  ms.destroySoon('arg3')
  assert.strictEqual(destCalls.destroySoon, 1)

  ms.close()
  assert.strictEqual(destCalls.close, 1)

  // Test with _src
  var srcCalls = { destroy: 0, destroySoon: 0, close: 0 }
  var src = new PassThrough()
  src.destroy = function (...args) {
    srcCalls.destroy++
    assert.deepStrictEqual(args, ['srcArg1'])
  }
  src.destroySoon = function (...args) {
    srcCalls.destroySoon++
    assert.deepStrictEqual(args, [])
  }
  src.close = function (...args) {
    srcCalls.close++
    assert.deepStrictEqual(args, ['closeArg'])
  }

  var ms2 = new MS()
  src.pipe(ms2)

  ms2.destroy('srcArg1')
  assert.strictEqual(srcCalls.destroy, 1)

  ms2.destroySoon()
  assert.strictEqual(srcCalls.destroySoon, 1)

  ms2.close('closeArg')
  assert.strictEqual(srcCalls.close, 1)

  // Test with both _src and _dest - both should be called
  var bothDestCalls = { destroy: 0 }
  var bothSrcCalls = { destroy: 0 }

  var bothDest = new PassThrough()
  bothDest.destroy = function () {
    bothDestCalls.destroy++
  }

  var bothSrc = new PassThrough()
  bothSrc.destroy = function () {
    bothSrcCalls.destroy++
  }

  var ms3 = new MS()
  bothSrc.pipe(ms3)
  ms3.pipe(bothDest)

  ms3.destroy()
  assert.strictEqual(bothDestCalls.destroy, 1)
  assert.strictEqual(bothSrcCalls.destroy, 1)

  // Test with no _src or _dest - should not throw
  var ms4 = new MS()
  assert.doesNotThrow(() => {
    ms4.destroy()
    ms4.destroySoon()
    ms4.close()
  })
})

test('muted control characters with prompt', function () {
  // Test with regular prompt
  var ms = new MS({ replace: '*', prompt: 'prompt> ' })
  var str = new PassThrough()
  ms.pipe(str)

  var expect = []
  str.on('data', function (c) {
    expect.push(c)
  })

  ms.mute()

  // Test control character without matching prompt - passed through unchanged
  ms.write('\u001b[2K')
  assert.strictEqual(expect.length, 1)
  assert.strictEqual(expect[0], '\u001b[2K')
  assert.strictEqual(ms._hadControl, true)

  expect = []

  // Test non-control character after control with prompt
  ms.write('prompt> world')
  assert.strictEqual(expect.length, 2)
  assert.strictEqual(expect[0], 'prompt> ')
  assert.strictEqual(expect[1], '*****')
  assert.strictEqual(ms._hadControl, false)

  expect = []

  // Test control character that starts with the prompt (edge case)
  // This tests the c.indexOf(this._prompt) === 0 branch
  var ms2 = new MS({ replace: '*', prompt: '\u001b[1m' })
  var str2 = new PassThrough()
  ms2.pipe(str2)

  var expect2 = []
  str2.on('data', function (c) {
    expect2.push(c)
  })

  ms2.mute()
  ms2.write('\u001b[1mhello')
  assert.strictEqual(expect2.length, 1)
  assert.strictEqual(expect2[0], '\u001b[1m*****')
  assert.strictEqual(ms2._hadControl, true)
})

test('end method with muted and replace', function (t, done) {
  var ms = new MS({ replace: '*' })
  var str = new PassThrough()
  ms.pipe(str)

  var dataEvents = []
  var endCalled = false

  str.on('data', function (c) {
    dataEvents.push(c)
  })
  str.on('end', function () {
    endCalled = true
    // When muted with replace: content should be replaced
    assert.strictEqual(dataEvents.length, 1)
    assert.strictEqual(dataEvents[0], '*****')
    assert.strictEqual(endCalled, true)
    done()
  })

  ms.mute()
  ms.end('hello')
})

test('end method with muted but no replace', function (t, done) {
  var ms = new MS()
  var str = new PassThrough()
  ms.pipe(str)

  var dataEvents = []
  var endCalled = false

  str.on('data', function (c) {
    dataEvents.push(c)
  })
  str.on('end', function () {
    endCalled = true
    // When muted without replace: c becomes null, no data event
    assert.strictEqual(dataEvents.length, 0)
    assert.strictEqual(endCalled, true)
    done()
  })

  ms.mute()
  ms.end('hello')
})

test('end method when not muted', function (t, done) {
  var ms = new MS({ replace: '*' })
  var str = new PassThrough()
  ms.pipe(str)

  var dataEvents = []
  var endCalled = false

  str.on('data', function (c) {
    dataEvents.push(c)
  })
  str.on('end', function () {
    endCalled = true
    // When not muted: content passes through unchanged
    assert.strictEqual(dataEvents.length, 1)
    assert.strictEqual(dataEvents[0], 'hello')
    assert.strictEqual(endCalled, true)
    done()
  })

  ms.end('hello')
})

test('end method with no content', function (t, done) {
  var ms = new MS({ replace: '*' })
  var str = new PassThrough()
  ms.pipe(str)

  var dataEvents = []
  var endCalled = false

  str.on('data', function (c) {
    dataEvents.push(c)
  })
  str.on('end', function () {
    endCalled = true
    // When no content provided: no data event
    assert.strictEqual(dataEvents.length, 0)
    assert.strictEqual(endCalled, true)
    done()
  })

  ms.mute()
  ms.end()
})
