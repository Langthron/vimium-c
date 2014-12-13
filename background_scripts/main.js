// Generated by CoffeeScript 1.8.0
(function() {
  var BackgroundCommands, checkKeyQueue, completers, completionSources, copyToClipboard, currentVersion
    , fetchFileContents, filterCompleter, frameIdsForTab, generateCompletionKeys
    , getActualKeyStrokeLength, getCompletionKeysRequest, getCurrentTabUrl
    , getCurrentTimeInSeconds, handleFrameFocused, handleMainPort, handleUpdateScrollPosition
    , helpDialogHtmlForCommandGroup, isEnabledForUrl, keyQueue, moveTab, namedKeyRegex
    , openOptionsPageInNewTab, openUrlInCurrentTab, openUrlInIncognito, openUrlInNewTab, restoreSession
    , populateKeyCommands, portHandlers, refreshCompleter, registerFrame
    , removeTabsRelative, repeatFunction, root, saveHelpDialogSettings, selectSpecificTab, selectTab
    , selectionChangedHandlers, requestHandlers, sendRequestToAllTabs, setBrowserActionIcon
    , shouldShowUpgradeMessage, singleKeyCommands, splitKeyIntoFirstAndSecond, splitKeyQueue, tabInfoMap
    , tabLoadedHandlers, tabQueue, unregisterFrame, updateActiveState, updateOpenTabs
    , updatePositionsAndWindowsForAllTabsInWindow, updateScrollPosition, upgradeNotificationClosed
    , validFirstKeys, hasActionIcon;

  root = typeof exports !== "undefined" && exports !== null ? exports : window;

  hasActionIcon = ! ! (chrome.browserAction && chrome.browserAction.setIcon);

  currentVersion = Utils.getCurrentVersion();

  root.tabQueue = tabQueue = {};

  root.tabInfoMap = tabInfoMap = {};

  keyQueue = "";

  validFirstKeys = {};

  singleKeyCommands = [];

  frameIdsForTab = {};

  namedKeyRegex = /^(<(?:[amc]-.|(?:[amc]-)?[a-z0-9]{2,5})>)(.*)$/;

  selectionChangedHandlers = [];

  tabLoadedHandlers = {};

  completionSources = {
    bookmarks: new BookmarkCompleter(),
    history: new HistoryCompleter(),
    domains: new DomainCompleter(),
    tabs: new TabCompleter(),
    seachEngines: new SearchEngineCompleter()
  };

  completers = {
    omni: new MultiCompleter([completionSources.seachEngines, completionSources.bookmarks, completionSources.history, completionSources.domains]),
    bookmarks: new MultiCompleter([completionSources.bookmarks]),
    history: new MultiCompleter([completionSources.history]),
    tabs: new MultiCompleter([completionSources.tabs])
  };

  chrome.runtime.onConnect.addListener(function(port) {
    var handler = portHandlers[port.name];
    if (handler) {
      port.onMessage.addListener(handler);
    }
  });

  getCurrentTabUrl = function(request, tab) {
    return tab.url;
  };

  root.isEnabledForUrl = isEnabledForUrl = function(request) {
    var rule = Exclusions.getRule(request.url);
    return {
      rule: rule,
      isEnabledForUrl: !rule || (!!rule.passKeys),
      passKeys: rule && rule.passKeys || ""
    };
  };

  root.addExclusionRule = function(pattern, passKeys) {
    if (pattern = pattern.trim()) {
      Exclusions.updateOrAdd({
        pattern: pattern,
        passKeys: passKeys
      });
      hasActionIcon && chrome.tabs.query({
        windowId: chrome.windows.WINDOW_ID_CURRENT,
        active: true
      }, function(tabs) {
        updateActiveState(tabs[0].id, tabs[0].url);
      });
    }
  };

  root.removeExclusionRule = function(pattern) {
    if (pattern = pattern.trim()) {
      Exclusions.remove(pattern);
      hasActionIcon && chrome.tabs.query({
        windowId: chrome.windows.WINDOW_ID_CURRENT,
        active: true
      }, function(tabs) {
        updateActiveState(tabs[0].id, tabs[0].url);
      });
    }
  };

  saveHelpDialogSettings = function(request) {
    Settings.set("helpDialog_showAdvancedCommands", request.showAdvancedCommands);
  };

  root.helpDialogHtml = function(showUnboundCommands, showCommandNames, customTitle) {
    var command, commandsToKey, dialogHtml, group, key;
    commandsToKey = {};
    for (key in Commands.keyToCommandRegistry) {
      command = Commands.keyToCommandRegistry[key].command;
      commandsToKey[command] = (commandsToKey[command] || []).concat(key);
    }
    dialogHtml = fetchFileContents("pages/help_dialog.html");
    for (group in Commands.commandGroups) {
      dialogHtml = dialogHtml.replace("{{" + group + "}}", helpDialogHtmlForCommandGroup(group, commandsToKey, Commands.availableCommands, showUnboundCommands, showCommandNames));
    }
    dialogHtml = dialogHtml.replace("{{version}}", currentVersion);
    dialogHtml = dialogHtml.replace("{{title}}", customTitle || "Help");
    return dialogHtml;
  };

  helpDialogHtmlForCommandGroup = function(group, commandsToKey, availableCommands, showUnboundCommands, showCommandNames) {
    var bindings, command, html, isAdvanced, _i, _len, _ref;
    html = [];
    _ref = Commands.commandGroups[group];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      command = _ref[_i];
      bindings = (commandsToKey[command] || [""]).join(", ");
      if (showUnboundCommands || commandsToKey[command]) {
        isAdvanced = Commands.advancedCommands.indexOf(command) >= 0;
        html.push("<tr class='vimB vimI vimiumHelpTr" + (isAdvanced ? " vimiumHelpAdvanced'>" : "'>")
          , "<td class='vimB vimI vimiumHelpTd vimiumHelpShortKey'><span class='vimB vimI vimiumHelpShortKey2'>", Utils.escapeHtml(bindings)
          , "</span></td>\n<td class='vimB vimI vimiumHelpTd'>:</td>\n<td class='vimB vimI vimiumHelpTd vimiumHelpCommandInfo'>"
          , Utils.escapeHtml(availableCommands[command].description));
        if (showCommandNames) {
          html.push("<span class='vimB vimI vimiumHelpCommandName'>(" + command + ")</span>");
        }
        html.push("</td>\n</tr>");
      }
    }
    return html.join("\n");
  };

  fetchFileContents = function(extensionFileName) {
    var req = new XMLHttpRequest();
    req.open("GET", chrome.runtime.getURL(extensionFileName), false);
    req.send();
    return req.responseText;
  };

  getCompletionKeysRequest = function(request, keysToCheck) {
    if (typeof keysToCheck !== "string") {
      keysToCheck = "";
    }
    return {
      name: "refreshCompletionKeys",
      completionKeys: generateCompletionKeys(keysToCheck),
      validFirstKeys: validFirstKeys
    };
  };

  openUrlInCurrentTab = function(request, tab, _2, callback) {
    chrome.tabs.update(tab.id, {
      url: Utils.convertToUrl(request.url)
    }, callback ? function (newTab) {
      extend(tab, newTab);
      callback();
    } : null);
  };

  openUrlInNewTab = function(request, tab, _2, callback) {
    chrome.tabs.create({
      url: Utils.convertToUrl(request.url),
      index: tab.index + 1,
      selected: true
    }, callback ? function (newTab) {
      extend(tab, newTab);
      callback();
    } : null);
  };
  
  restoreSession = function(request, tab) {
    BackgroundCommands.restoreTab(null, null, tab, null, request.sessionId);
  }

  openUrlInIncognito = function(request) {
    chrome.windows.create({
      url: Utils.convertToUrl(request.url),
      incognito: true
    });
  };

  upgradeNotificationClosed = function(request) {
    Settings.set("previousVersion", currentVersion);
    sendRequestToAllTabs({
      name: "hideUpgradeNotification"
    });
  };

  copyToClipboard = function(request) {
    Clipboard.copy(request.data);
  };

  selectSpecificTab = function(request) {
    chrome.tabs.get(request.sessionId, function(tab) {
      chrome.windows.update(tab.windowId, {
        focused: true
      });
      chrome.tabs.update(request.sessionId, {
        selected: true
      });
    });
  };

  refreshCompleter = function(request) {
    completers[request.name].refresh();
  };

  filterCompleter = function(args, port) {
    completers[args.name].filter(args.query ? args.query.trim().split(/\s+/) : [], function(results) {
      port.postMessage({
        id: args.id,
        results: results
      });
    });
  };

  getCurrentTimeInSeconds = function() {
    return Math.floor((new Date()).getTime() / 1000);
  };

  chrome.tabs.onSelectionChanged.addListener(function(tabId, selectionInfo) {
    if (selectionChangedHandlers.length > 0) {
      var callback = selectionChangedHandlers.pop();
      if (callback) {
        callback();
      }
    }
  });

  repeatFunction = function(func, totalCount, tab, currentCount, frameId, port) {
    if (currentCount < totalCount) {
      func(tab, function() {
        repeatFunction(func, totalCount, tab, currentCount + 1, frameId, port);
      }, frameId, port);
    }
  };

  BackgroundCommands = {
    createTab: function(tab, callback) {
      chrome.windows.get(tab.windowId, function(wnd) {
        var url = Settings.get("newTabUrl");
        if (! wnd.incognito || /^https?:/i.test(url) || url.toLowerCase() === Settings.defaults.newTabUrl) {
          chrome.tabs.create({
            windowId: wnd.id,
            index: tab.index + 1,
            url: url
          }, callback);
          return;
        }
        // other urls will be disabled if incognito
        chrome.tabs.getAllInWindow(tab.windowId, function(allTabs) {
          var urlLower = url.toLowerCase().split('#', 1)[0];
          if (urlLower.indexOf("://") < 0) {
            urlLower = chrome.runtime.getURL(urlLower);
          }
          allTabs = allTabs.filter(function(tab1) {
            var url = tab1.url.toLowerCase(), end = url.indexOf("#");
            return ((end < 0) ? url : url.substring(0, end)) === urlLower;
          });
          if (allTabs.length > 0) {
            urlLower = allTabs.filter(function(tab1) {
              return tab1.index >= tab.index;
            });
            tab = (urlLower.length > 0) ? urlLower[0] : allTabs[allTabs.length - 1];
            chrome.tabs.duplicate(tab.id, callback);
            return;
          }
          chrome.tabs.create({
            selected: false,
            url: url
          }, function(newTab) {
            chrome.windows.create({
              left: 0,
              top: 0,
              width: 50,
              height: 50,
              incognito: true,
              tabId: newTab.id
            }, function() {
              chrome.tabs.move(newTab.id, {
                index: tab.index + 1,
                windowId: wnd.id
              }, function() {
                chrome.tabs.update(newTab.id, {
                  selected: true 
                }, callback);
              });
            });
          });
        });
      });
    },
    duplicateTab: function(tab, callback) {
      chrome.tabs.duplicate(tab.id, callback);
    },
    moveTabToNewWindow: function(tab, callback) {
      chrome.windows.get(tab.windowId, function(wnd) {
        chrome.windows.create({
          tabId: tab.id,
          incognito: wnd.incognito
        }, callback ? function(newWnd) {
          tab.windowId = newWnd.id || tab.windowId;
          callback();
        } : null);
      });
    },
    moveTabToIncognito: function(tab, callback) {
      chrome.windows.get(tab.windowId, function(wnd) {
        if (wnd.incognito) {
          if (callback) {
            callback();
          }
          return;
        }
        var options = {
          type: "normal",
          incognito: true
        };
        wnd = tab.url.toLowerCase();
        if (wnd.startsWith("chrome") && wnd !== Settings.defaults.newTabUrl) {
          options.tabId = tab.id;
        } else {
          options.url = tab.url;
          chrome.tabs.remove(tab.id);
        }
        chrome.windows.create(options, callback ? function(newWnd) {
          chrome.tabs.getSelected(null, function(newTab) {
            extend(tab, newTab);
            callback();
          });
        } : null);
      });
    },
    nextTab: function(tab, callback) {
      selectTab(callback, "next", tab);
    },
    previousTab: function(tab, callback) {
      selectTab(callback, "previous", tab);
    },
    firstTab: function(tab, callback) {
      selectTab(callback, "first", tab);
    },
    lastTab: function(tab, callback) {
      selectTab(callback, "last", tab);
    },
    removeTab: function(tab, callback) {
      chrome.tabs.getAllInWindow(tab.windowId, function(curTabs) {
        if (! curTabs || curTabs.length !== 1) {
          selectionChangedHandlers.push(callback);
          chrome.tabs.remove(tab.id);
          return;
        }
        chrome.windows.getAll(function(wnds) {
          var url = Settings.get("newTabUrl"), toCreate;
          wnds = wnds.filter(function(wnd) {
            return wnd.type === "normal";
          });
          if (wnds.length <= 1) {
            toCreate = {};
            if (wnds.length === 1 && wnds[0].incognito && (/^https?:/i.test(url)
              || url.toLowerCase() === Settings.defaults.newTabUrl)) {
              // other urls will be disabled if incognito
              toCreate.windowId = wnds[0].id;
            }
          }
          else if (! tab.incognito) {
            wnds = wnds.filter(function(wnd) {
              return ! wnd.incognito;
            });
            if (wnds.length == 1 && wnds[0].id === tab.windowId) {
              toCreate = { windowId: wnds[0].id };
            }
          }
          if (callback) {
            selectionChangedHandlers.push(function() {
              chrome.tabs.getSelected(null, function(newTab) {
                extend(tab, newTab);
                callback();
              });
            });
          }
          chrome.tabs.remove(tab.id);
          if (toCreate) {
            toCreate.url = url;
            chrome.tabs.create(toCreate);
          }
        });
      });
    },
    restoreTab: function(tab, callback, _2, _3, sessionId) {
      if (chrome.sessions) {
        chrome.sessions.restore(sessionId || null, function(restoredSession) {
          if (chrome.runtime.lastError) {
            return;
          }
          if (callback) {
            extend(tab, restoredSession.tab);
            callback();
          }
        });
        return;
      }
      var tabQueueEntry, tabQ = tabQueue[tab.windowId];
      if (!(tabQ && tabQ.length > 0)) {
        if (callback) {
          callback();
        }
        return;
      }
      if (typeof sessionId === "number" && sessionId >= 0 && sessionId < tabQ.length) {
        tabQueueEntry = tabQ.splice(sessionId, 1)[0];
      } else {
        tabQueueEntry = tabQ.pop();
      }
      if (tabQ.length === 0) {
        delete tabQueue[tab.windowId];
      }
      chrome.tabs.create({
        url: tabQueueEntry.url,
        index: tabQueueEntry.positionIndex
      }, function(newTab) {
        tabLoadedHandlers[newTab.id] = function(port) {
          port.postMessage({
            name: "setScrollPosition",
            scrollX: tabQueueEntry.scrollX,
            scrollY: tabQueueEntry.scrollY
          });
        };
        if (callback) {
          extend(tab, newTab);
          callback();
        }
      });
    },
    openCopiedUrlInCurrentTab: function(tab, callback) {
      openUrlInCurrentTab({
        url: Clipboard.paste()
      }, tab, null, callback);
    },
    openCopiedUrlInNewTab: function(tab, callback) {
      openUrlInNewTab({
        url: Clipboard.paste()
      }, tab, null, callback);
    },
    togglePinTab: function(tab, callback) {
      tab.pinned = !tab.pinned;
      chrome.tabs.update(tab.id, {
        pinned: tab.pinned
      }, callback);
    },
    showHelp: function(_0, callback, frameId, port) {
      port.postMessage({
        name: "toggleHelpDialog",
        dialogHtml: helpDialogHtml(),
        frameId: frameId
      });
      if (callback) {
        callback();
      }
    },
    moveTabLeft: function(tab, count) {
      moveTab(tab, -count);
    },
    moveTabRight: function(tab, count) {
      moveTab(tab, count);
    },
    nextFrame: function(tab, count, frameId) {
      var frames = frameIdsForTab[tab.id];
      count = (count + Math.max(0, frameIdsForTab[tab.id].indexOf(frameId))) % frames.length;
      frames = frameIdsForTab[tab.id] = frames.slice(count).concat(frames.slice(0, count));
      chrome.runtime.sendMessage(tab.id, {
        name: "focusFrame",
        frameId: frames[0],
        highlight: true
      });
    },
    closeTabsOnLeft: function(tab) {
      removeTabsRelative(tab, "before");
    },
    closeTabsOnRight: function(tab) {
      removeTabsRelative(tab, "after");
    },
    closeOtherTabs: function(tab) {
      removeTabsRelative(tab, "both");
    }
  };

  removeTabsRelative = function(activeTab, direction) {
    chrome.tabs.getAllInWindow(activeTab.windowId, function(tabs) {
      var activeTabIndex, shouldDelete, tab, toRemove, _i, _len;
      activeTabIndex = activeTab.index;
      shouldDelete = (direction === "before") ? function(index) {
        return index < activeTabIndex;
      } : (direction === "after") ? function(index) {
        return index > activeTabIndex;
      } : (direction === "both") ? function(index) {
        return index !== activeTabIndex;
      } : function() {
        return false;
      };
      toRemove = [];
      for (_i = 0, _len = tabs.length; _i < _len; _i++) {
        tab = tabs[_i];
        if (!tab.pinned && shouldDelete(tab.index)) {
          toRemove.push(tab.id);
        }
      }
      chrome.tabs.remove(toRemove);
    });
  };

  moveTab = function(tab, direction) {
    tab.index = Math.max(0, tab.index + direction);
    chrome.tabs.move(tab.id, {
      index: tab.index
    });
  };

  selectTab = function(callback, direction, currentTab) {
    chrome.tabs.getAllInWindow(currentTab.windowId, function(tabs) {
      if (!(tabs.length > 1)) {
        return;
      }
      var toSelect;
      switch (direction) {
      case "next":
        toSelect = tabs[(currentTab.index + 1 + tabs.length) % tabs.length];
        break;
      case "previous":
        toSelect = tabs[(currentTab.index - 1 + tabs.length) % tabs.length];
        break;
      case "first":
        toSelect = tabs[0];
        break;
      case "last":
        toSelect = tabs[tabs.length - 1];
        break;
      }
      if (toSelect) {
        if (callback) {
          selectionChangedHandlers.push(function() {
            extend(currentTab, toSelect);
            currentTab.active = true;
            callback();
          });
        }
        chrome.tabs.update(toSelect.id, {
          selected: true
        });
      } else if (callback) {
        callback();
      }
    });
  };

  updateOpenTabs = function(tab) {
    var _ref;
    if ((_ref = tabInfoMap[tab.id]) && _ref.deletor) {
      clearTimeout(_ref.deletor);
    }
    tabInfoMap[tab.id] = {
      url: tab.url,
      title: tab.title,
      positionIndex: tab.index,
      windowId: tab.windowId,
      scrollX: 0,
      scrollY: 0,
      deletor: 0
    };
    delete frameIdsForTab[tab.id];
  };

  setBrowserActionIcon = function(tabId, path) {
    hasActionIcon && chrome.browserAction.setIcon({
      tabId: tabId,
      path: path
    });
  };

  updateActiveState = function(tabId, url) {
    if (!hasActionIcon) return;
    var enabledIcon = "icons/browser_action_enabled.png",
      disabledIcon = "icons/browser_action_disabled.png",
      partialIcon = "icons/browser_action_partial.png";
    chrome.tabs.sendMessage(tabId, {
      name: "getActiveState"
    }, function(response) {
      var config, currentPasskeys, enabled, isCurrentlyEnabled, passKeys;
      if (response) {
        isCurrentlyEnabled = response.enabled;
        currentPasskeys = response.passKeys;
        config = isEnabledForUrl({
          url: url
        });
        enabled = config.isEnabledForUrl;
        passKeys = config.passKeys;
        if (enabled && passKeys) {
          setBrowserActionIcon(tabId, partialIcon);
        } else if (enabled) {
          setBrowserActionIcon(tabId, enabledIcon);
        } else {
          setBrowserActionIcon(tabId, disabledIcon);
        }
        if (isCurrentlyEnabled !== enabled || currentPasskeys !== passKeys) {
          chrome.tabs.sendMessage(tabId, {
            name: "setState",
            enabled: enabled,
            passKeys: passKeys
          });
        }
      } else {
        setBrowserActionIcon(tabId, disabledIcon);
      }
    });
  };

  handleUpdateScrollPosition = function(request, tab) {
    updateScrollPosition(tab.id, request.scrollX, request.scrollY);
  };

  updateScrollPosition = function(tabId, scrollX, scrollY) {
    tabInfoMap[tabId].scrollX = scrollX;
    tabInfoMap[tabId].scrollY = scrollY;
  };

  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    var old, temp;
    if (changeInfo.status !== "loading" ||
        (changeInfo.url != null && Utils.isTabWithSameUrl(tabInfoMap[tabId], tab))) {
      return;
    }
    chrome.tabs.insertCSS(tabId, {
      allFrames: true,
      code: Settings.get("userDefinedLinkHintCss"),
      runAt: "document_start"
    }, function() {
      return chrome.runtime.lastError;
    });
    if (changeInfo.url != null) {
      updateOpenTabs(tab);
    }
    hasActionIcon && updateActiveState(tab.id, tab.url);
  });

  chrome.tabs.onAttached.addListener(function(tabId, attachedInfo) {
    if (tabInfoMap[tabId]) {
      updatePositionsAndWindowsForAllTabsInWindow(tabInfoMap[tabId].windowId);
    }
    updatePositionsAndWindowsForAllTabsInWindow(attachedInfo.newWindowId);
  });

  chrome.tabs.onMoved.addListener(function(tabId, moveInfo) {
    updatePositionsAndWindowsForAllTabsInWindow(moveInfo.windowId);
  });

  chrome.tabs.onRemoved.addListener(function(tabId) {
    var i, openTabInfo, ref;
    openTabInfo = tabInfoMap[tabId];
    if (!openTabInfo || !openTabInfo.windowId) {
      return true;
    }
    updatePositionsAndWindowsForAllTabsInWindow(openTabInfo.windowId);
    if (!chrome.sessions) {
      if (/^(chrome|view-source):/.test(openTabInfo.url)) {
        ref = tabQueue[openTabInfo.windowId];
        for (i in ref) {
          if (ref[i].positionIndex > openTabInfo.positionIndex) {
            -- ref[i].positionIndex;
          }
        }
        // return;
      }
      openTabInfo.lastVisitTime = new Date().getTime();
      if (tabQueue[openTabInfo.windowId]) {
        tabQueue[openTabInfo.windowId].push(openTabInfo);
      } else {
        tabQueue[openTabInfo.windowId] = [openTabInfo];
      }
    }
    openTabInfo.deletor = setTimeout(function() {
      delete tabInfoMap[tabId];
    }, 1000);
    delete frameIdsForTab[tabId];
  });

  hasActionIcon && chrome.tabs.onActiveChanged.addListener(function(tabId, selectInfo) {
    chrome.tabs.get(tabId, function(tab) {
      updateActiveState(tabId, tab.url);
    });
  });

  if (!chrome.sessions) {
    chrome.windows.onRemoved.addListener(function(windowId) {
      delete tabQueue[windowId];
    });
  }

  updatePositionsAndWindowsForAllTabsInWindow = function(windowId) {
    chrome.tabs.getAllInWindow(windowId, function(tabs) {
      if (!tabs) return;
      var openTabInfo, tab, _i, _len;
      for (_i = 0, _len = tabs.length; _i < _len; _i++) {
        tab = tabs[_i];
        openTabInfo = tabInfoMap[tab.id];
        if (openTabInfo) {
          openTabInfo.positionIndex = tab.index;
          openTabInfo.windowId = tab.windowId;
        }
      }
    });
  };

  splitKeyIntoFirstAndSecond = function(key) {
    return (key.search(namedKeyRegex) === 0) ? {
      first: RegExp.$1,
      second: RegExp.$2
    } : {
      first: key[0],
      second: key.slice(1)
    };
  };

  getActualKeyStrokeLength = function(key) {
    if (key.search(namedKeyRegex) === 0) {
      return 1 + getActualKeyStrokeLength(RegExp.$2);
    } else {
      return key.length;
    }
  };

  populateKeyCommands = function() {
    var key, len;
    for (key in Commands.keyToCommandRegistry) {
      len = getActualKeyStrokeLength(key);
      if (len === 1) {
        singleKeyCommands.push(key);
      }
      else if (len === 2) {
        validFirstKeys[splitKeyIntoFirstAndSecond(key).first] = true;
      }
    }
  };

  root.refreshCompletionKeysAfterMappingSave = function() {
    validFirstKeys = {};
    singleKeyCommands = [];
    populateKeyCommands();
    sendRequestToAllTabs(getCompletionKeysRequest());
  };

  generateCompletionKeys = function(keysToCheck) {
    var command, completionKeys, count, key, splitHash, splitKey;
    splitHash = splitKeyQueue(keysToCheck || keyQueue);
    command = splitHash.command;
    count = splitHash.count;
    completionKeys = singleKeyCommands.slice(0);
    if (getActualKeyStrokeLength(command) === 1) {
      for (key in Commands.keyToCommandRegistry) {
        splitKey = splitKeyIntoFirstAndSecond(key);
        if (splitKey.first === command) {
          completionKeys.push(splitKey.second);
        }
      }
    }
    return completionKeys;
  };

  splitKeyQueue = function(queue) {
    var match = /([1-9][0-9]*)?(.*)/.exec(queue);
    return {
      count: parseInt(match[1], 10),
      command: match[2]
    };
  };

  handleMainPort = function(request, port) {
    var key, msgId = request._msgId;
    if (msgId) {
      request = request.request;
    }
    if (key = request.handlerKey) {
      if (key === "<ESC>") {
        keyQueue = "";
      } else {
        keyQueue = checkKeyQueue(keyQueue + key, port, request.frameId);
      }
      /* port.postMessage({
        name: "currentKeyQueue",
        keyQueue: keyQueue
      }); */
    }
    else if (key = request.handler) {
      key = requestHandlers[key];
      if (key) {
        chrome.tabs.getSelected(null, function(tab) {
          key = key(request, tab, port);
          if (msgId) {
            port.postMessage({
              name: "response",
              _msgId: msgId,
              response: key
            });
          }
        });
      }
    }
    else if (key = request.handlerSettings) {
      if (key === "get") {
        for (var i = 0, ref = request.keys, values = new Array(ref.length); i < ref.length; i++) {
          values[i] = Settings.get(ref[i]);
        }
        port.postMessage({
          name: "settings",
          keys: request.keys,
          values: values
        });
      } else if (key === "set") {
        Settings.set(request.key, request.value);
      }
    }
  };

  checkKeyQueue = function(keysToCheck, port, frameId) {
    var command, count, newKeyQueue, refreshedCompletionKeys, registryEntry, runCommand, splitHash, splitKey;
    refreshedCompletionKeys = false;
    splitHash = splitKeyQueue(keysToCheck);
    command = splitHash.command;
    count = splitHash.count;
    if (command.length === 0) {
      return keysToCheck;
    }
    if (isNaN(count)) {
      count = 1;
    }
    if (Commands.keyToCommandRegistry[command]) {
      registryEntry = Commands.keyToCommandRegistry[command];
      runCommand = true;
      if (registryEntry.noRepeat) {
        count = 1;
      } else if (registryEntry.repeatLimit && count > registryEntry.repeatLimit) {
        runCommand = confirm("You have asked Vimium to perform " + count + " repeats of the command:\n" + Commands.availableCommands[registryEntry.command].description + "\n\nAre you sure you want to continue?");
      }
      if (runCommand) {
        if (registryEntry.isBackgroundCommand) {
          chrome.tabs.getSelected(null, function(tab) {
            if (registryEntry.passCountToFunction) {
              BackgroundCommands[registryEntry.command](tab, count, frameId, port);
            } else if (registryEntry.noRepeat) {
              BackgroundCommands[registryEntry.command](tab, 1, frameId, port);
            } else {
              repeatFunction(BackgroundCommands[registryEntry.command], count, tab, 0, frameId, port);
            }
          });
        } else {
          port.postMessage({
            name: "executePageCommand",
            command: registryEntry.command,
            frameId: frameId,
            count: count,
            passCountToFunction: registryEntry.passCountToFunction,
            completionKeys: generateCompletionKeys("")
          });
          refreshedCompletionKeys = true;
        }
      }
      newKeyQueue = "";
    } else if (getActualKeyStrokeLength(command) > 1) {
      splitKey = splitKeyIntoFirstAndSecond(command);
      if (Commands.keyToCommandRegistry[splitKey.second]) {
        newKeyQueue = checkKeyQueue(splitKey.second, port, frameId);
      } else {
        newKeyQueue = (validFirstKeys[splitKey.second] ? splitKey.second : "");
      }
    } else {
      newKeyQueue = (validFirstKeys[command] ? count.toString() + command : "");
    }
    if (!refreshedCompletionKeys) {
      port.postMessage(getCompletionKeysRequest(null, newKeyQueue));
    }
    return newKeyQueue;
  };

  sendRequestToAllTabs = function(args) {
    chrome.windows.getAll({
      populate: true
    }, function(windows) {
      var _i, _len, _j, _len1, _ref;
      for (_i = 0, _len = windows.length; _i < _len; _i++) {
        _ref = windows[_i].tabs;
        for (_j = 0, _len1 = _ref.length; _j < _len1; _j++) {
          chrome.tabs.sendMessage(_ref[_j].id, args, null);
        }
      }
    });
  };

  shouldShowUpgradeMessage = function() {
    if (!Settings.get("previousVersion")) {
      Settings.set("previousVersion", currentVersion);
      return false;
    }
    return Utils.compareVersions(currentVersion, Settings.get("previousVersion")) === 1;
  };

  openOptionsPageInNewTab = function(request, tab) {
    chrome.tabs.create({
      url: chrome.runtime.getURL("pages/options.html"),
      index: tab.index + 1
    });
  };

  registerFrame = function(request, tab, port) {
    var tabId = tab.id;
    if (tabLoadedHandlers[tabId]) {
      toCall = tabLoadedHandlers[tabId];
      delete tabLoadedHandlers[tabId];
      toCall(port);
    }
    if (! isNaN(request.frameId)) {
      (frameIdsForTab[tabId] || (frameIdsForTab[tabId] = [])).push(request.frameId);
    }
    if (shouldShowUpgradeMessage()) {
      port.postMessage({
        name: "showUpgradeNotification",
        version: currentVersion
      });
    }
  };

  unregisterFrame = function(request, tab) {
    var tabId = tab.id;
    if (request.isTop) {
      updateOpenTabs(tab);
      updateScrollPosition(tabId, request.scrollX, request.scrollY);
    }
    else if (frameIdsForTab[tabId] != null) {
      frameIdsForTab[tabId] = frameIdsForTab[tabId].filter(function(id) {
        return id !== request.frameId;
      });
    }
  };

  handleFrameFocused = function(request, tab) {
    var tabId = tab.id;
    if (frameIdsForTab[tabId] == null) {
      return;
    }
    frameIdsForTab[tabId] = frameIdsForTab[tabId].filter(function(id) {
      return id !== request.frameId;
    });
    frameIdsForTab[tabId].unshift(request.frameId);
  };

  portHandlers = {
    main: handleMainPort,
    filterCompleter: filterCompleter
  };

  requestHandlers = {
    getCompletionKeys: getCompletionKeysRequest,
    getCurrentTabUrl: getCurrentTabUrl,
    openUrlInNewTab: openUrlInNewTab,
    restoreSession: restoreSession,
    openUrlInIncognito: openUrlInIncognito,
    openUrlInCurrentTab: openUrlInCurrentTab,
    openOptionsPageInNewTab: openOptionsPageInNewTab,
    registerFrame: registerFrame,
    unregisterFrame: unregisterFrame,
    frameFocused: handleFrameFocused,
    upgradeNotificationClosed: upgradeNotificationClosed,
    updateScrollPosition: handleUpdateScrollPosition,
    copyToClipboard: copyToClipboard,
    isEnabledForUrl: isEnabledForUrl,
    saveHelpDialogSettings: saveHelpDialogSettings,
    selectSpecificTab: selectSpecificTab,
    refreshCompleter: refreshCompleter,
    createMark: Marks.create,
    gotoMark: Marks.goTo
  };

  Commands.clearKeyMappingsAndSetDefaults();

  if (Settings.has("keyMappings")) {
    Commands.parseCustomKeyMappings(Settings.get("keyMappings"));
  }

  populateKeyCommands();

  if (shouldShowUpgradeMessage()) {
    sendRequestToAllTabs({
      name: "showUpgradeNotification",
      version: currentVersion
    });
  }

  chrome.windows.getAll({
    populate: true
  }, function(windows) {
    var createScrollPositionHandler, tab, _i, _len, _j, _len1, _ref;
    createScrollPositionHandler = function(tab) {
      return function(response) {
        if (response != null) {
          updateScrollPosition(tab.id, response.scrollX, response.scrollY);
        }
      };
    };
    for (_i = 0, _len = windows.length; _i < _len; _i++) {
      _ref = windows[_i].tabs;
      for (_j = 0, _len1 = _ref.length; _j < _len1; _j++) {
        tab = _ref[_j];
        updateOpenTabs(tab);
        chrome.tabs.sendMessage(tab.id, {
          name: "getScrollPosition"
        }, createScrollPositionHandler(tab));
      }
    }
  });

  // Sync.init();

})();
