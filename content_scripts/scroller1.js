// Generated by CoffeeScript 1.8.0
(function() {
  var CoreScroller, activatedElement, checkVisibility, doesScroll, findScrollableElement, getDimension, performScroll, root, scrollProperties, shouldScroll;

  activatedElement = null;

  scrollProperties = {
    x: {
      axisName: 'scrollLeft',
      max: 'scrollWidth',
      viewSize: 'clientHeight'
    },
    y: {
      axisName: 'scrollTop',
      max: 'scrollHeight',
      viewSize: 'clientWidth'
    }
  };

  getDimension = function(el, direction, amount) {
    var name;
    if (Utils.isString(amount)) {
      name = amount;
      if (name === 'viewSize' && el === document.body) {
        if (direction === 'x') {
          return window.innerWidth;
        } else {
          return window.innerHeight;
        }
      } else {
        return el[scrollProperties[direction][name]];
      }
    } else {
      return amount;
    }
  };

  performScroll = function(element, direction, amount) {
    var axisName, before;
    axisName = scrollProperties[direction].axisName;
    before = element[axisName];
    element[axisName] += amount;
    return element[axisName] === amount + before;
  };

  shouldScroll = function(element, direction) {
    var computedStyle, _ref;
    computedStyle = window.getComputedStyle(element);
    if (computedStyle.getPropertyValue("overflow-" + direction) === "hidden") {
      return false;
    }
    if ((_ref = computedStyle.getPropertyValue("visibility")) === "hidden" || _ref === "collapse") {
      return false;
    }
    if (computedStyle.getPropertyValue("display") === "none") {
      return false;
    }
    return true;
  };

  doesScroll = function(element, direction, amount, factor) {
    var delta;
    delta = factor * getDimension(element, direction, amount) || -1;
    delta = Math.sign(delta);
    return performScroll(element, direction, delta) && performScroll(element, direction, -delta);
  };

  findScrollableElement = function(element, direction, amount, factor) {
    while (element !== document.body && !(doesScroll(element, direction, amount, factor) && shouldScroll(element, direction))) {
      element = element.parentElement || document.body;
    }
    return element;
  };

  checkVisibility = function(element) {
    var rect;
    rect = activatedElement.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
      return activatedElement = element;
    }
  };

  CoreScroller = {
    smoothScroll: false,
    time: 0,
    lastEvent: null,
    keyIsDown: false,
    init: function() {
      handlerStack.push({
        keydown: function(event) {
          CoreScroller.keyIsDown = true;
          CoreScroller.lastEvent = event;
          return true;
        },
        keyup: function() {
          CoreScroller.keyIsDown = false;
          CoreScroller.time += 1;
          return true;
        }
      });
    },
    wouldNotInitiateScroll: function() {
      return this.smoothScroll && (this.lastEvent && this.lastEvent.repeat);
    },
    minCalibration: 0.5,
    maxCalibration: 1.6,
    calibrationBoundary: 150,
    scroll: function(element, direction, amount) {
      var activationTime, animate, calibration, duration, myKeyIsStillDown, previousTimestamp, sign, totalDelta, totalElapsed, _ref;
      if (!amount) {
        return;
      }
      if (!this.smoothScroll) {
        performScroll(element, direction, amount);
        checkVisibility(element);
        return;
      }
      if ((_ref = this.lastEvent) != null ? _ref.repeat : undefined) {
        return;
      }
      activationTime = ++this.time;
      myKeyIsStillDown = (function(_this) {
        return function() {
          return _this.time === activationTime && _this.keyIsDown;
        };
      })(this);
      sign = Math.sign(amount);
      amount = Math.abs(amount);
      duration = Math.max(100, 20 * Math.log(amount));
      totalDelta = 0;
      totalElapsed = 0.0;
      calibration = 1.0;
      previousTimestamp = null;
      animate = (function(_this) {
        return function(timestamp) {
          var delta, elapsed;
          if (previousTimestamp == null) {
            previousTimestamp = timestamp;
          }
          if (timestamp === previousTimestamp) {
            return requestAnimationFrame(animate);
          }
          elapsed = timestamp - previousTimestamp;
          totalElapsed += elapsed;
          previousTimestamp = timestamp;
          if (myKeyIsStillDown() && 75 <= totalElapsed && (_this.minCalibration <= calibration && calibration <= _this.maxCalibration)) {
            if (1.05 * calibration * amount < _this.calibrationBoundary) {
              calibration *= 1.05;
            }
            if (_this.calibrationBoundary < 0.95 * calibration * amount) {
              calibration *= 0.95;
            }
          }
          delta = Math.ceil(amount * (elapsed / duration) * calibration);
          delta = myKeyIsStillDown() ? delta : Math.max(0, Math.min(delta, amount - totalDelta));
          if (delta && performScroll(element, direction, sign * delta)) {
            totalDelta += delta;
            return requestAnimationFrame(animate);
          } else {
            return checkVisibility(element);
          }
        };
      })(this);
      return requestAnimationFrame(animate);
    }
  };

  (typeof exports !== "undefined" && exports !== null ? exports : window).Scroller = {
    init: function() {
      handlerStack.push({
        DOMActivate: function() {
          activatedElement = event.target;
          return true;
        }
      });
      CoreScroller.init();
    },
    setSmoothScroll: function(smoothScroll) {
      CoreScroller.smoothScroll = smoothScroll;
    },
    scrollBy: function(direction, amount, factor) {
      var element, elementAmount;
      if (factor == null) {
        factor = 1;
      }
      if (!document.body && amount instanceof Number) {
        if (direction === "x") {
          window.scrollBy(amount, 0);
        } else {
          window.scrollBy(0, amount);
        }
        return;
      }
      activatedElement || (activatedElement = document.body);
      if (!activatedElement) {
        return;
      }
      if (!CoreScroller.wouldNotInitiateScroll()) {
        element = findScrollableElement(activatedElement, direction, amount, factor);
        elementAmount = factor * getDimension(element, direction, amount);
        return CoreScroller.scroll(element, direction, elementAmount);
      }
    },
    scrollTo: function(direction, pos) {
      var amount, element;
      if (!(document.body || activatedElement)) {
        return;
      }
      activatedElement || (activatedElement = document.body);
      element = findScrollableElement(activatedElement, direction, pos, 1);
      amount = getDimension(element, direction, pos) - element[scrollProperties[direction].axisName];
      return CoreScroller.scroll(element, direction, amount);
    }
  };

})();
