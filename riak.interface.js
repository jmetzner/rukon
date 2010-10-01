(function($) {
  $.riak = $.riak || {};
  $.extend($.riak, {

      key: null,
      oldKey: null,
      entry: {},
      links: {},
      isDirty: false,

      addRowForAttr: function(attrName) {
        var row = $("<tr><th class=\"key\"></th><td></td></tr>")
          .find("th").append($("<b></b>").text(attrName)).end()
          .appendTo("#contentTable");
        row.find("td").append($.riak._renderValue($.riak.entry[attrName]));
        $.riak._initKey(row, attrName);
        $.riak._initValue(row, attrName);
	$(".content tr").removeClass("odd").filter(":odd").addClass("odd");
        return row;
      },

      _initKey: function(row, attrName) {
        row.data("name", attrName);

        var cell = row.find("th");

        $("<button type='button' class='delete' title='Delete field'></button>").click(function() {
          delete $.riak.entry[attrName];
          row.remove();
          $.riak.isDirty = true;
          $(".content tr").removeClass("odd").filter(":odd").addClass("odd");
        }).prependTo(cell);

        cell.find("b").makeEditable({allowEmpty: false,
          accept: function(newName, oldName) {
            $.riak.entry[newName] = $.riak.entry[oldName];
            delete $.riak.entry[oldName];
            row.data("name", newName);
            $(this).text(newName);
            $.riak.isDirty = true;
          },
          begin: function() {
            row.find("th button.delete").hide();
            return true;
          },
          end: function(keyCode) {
            row.find("th button.delete").show();
            if (keyCode == 9) { // tab, move to editing the value
              row.find("td").dblclick();
            }
          },
          validate: function(newName, oldName) {
            $("div.error", this).remove();
            if (newName != oldName && $.riak.entry[newName] !== undefined) {
              $("<div class='error'>Already have an attribute with that name.</div>")
                .appendTo(this);
              return false;
            }
            return true;
          }
        });
      },

      _initValue: function(row, attrName) {
        row.find("td").makeEditable({acceptOnBlur: false, allowEmpty: true,
          createInput: function(value) {
            value = $.riak.entry[row.data("name")];
            var elem = $(this);
            if (elem.find("dl").length > 0 ||
                elem.find("code").is(".array, .object") ||
                typeof(value) == "string" && (value.length > 60 || value.match(/\n/))) {
              return $("<textarea rows='1' cols='40' spellcheck='false'></textarea>");
            }
            return $("<input type='text' spellcheck='false'>");
          },
          end: function() {
            $(this).children().remove();
            $(this).append($.riak._renderValue($.riak.entry[row.data("name")]));
          },
          prepareInput: function(input) {
            if ($(input).is("textarea")) {
              var height = Math.min(input.scrollHeight, document.body.clientHeight - 100);
              $(input).height(height).makeResizable({vertical: true}).enableTabInsertion();
            }
          },
          accept: function(newValue) {
            var fieldName = row.data("name");
            try {
              $.riak.entry[fieldName] = JSON.parse(newValue);
            } catch (err) {
              $.riak.entry[fieldName] = newValue;
            }
            $.riak.isDirty = true;
          },
          populate: function(value) {
            value = $.riak.entry[row.data("name")];
            if (typeof(value) == "string") {
              return value;
            }
            return $.riak.formatJSON(value);
          },
          validate: function(value) {
            $("div.error", this).remove();
            return true;
          }
        });
      },

      _renderValue: function(value) {
        function isNullOrEmpty(val) {
          if (val == null) return true;
          for (var i in val) return false;
          return true;
        }
        function render(val) {
          var type = typeof(val);
          if (type == "object" && !isNullOrEmpty(val)) {
            var list = $("<dl></dl>");
            for (var i in val) {
              $("<dt></dt>").text(i).appendTo(list);
              $("<dd></dd>").append(render(val[i])).appendTo(list);
            }
            return list;
          } else {
            var html = $.riak.formatJSON(val, {
              html: true,
              escapeStrings: false
            });
            var n = $(html);
            if (n.text().length > 140) {
              // This code reduces a long string in to a summarized string with a link to expand it.
              // Someone, somewhere, is doing something nasty with the event after it leaves these handlers.
              // At this time I can't track down the offender, it might actually be a jQuery propogation issue.
              var fulltext = n.text();
              var mintext = n.text().slice(0, 140);
              var e = $('<a href="#expand">...</a>');
              var m = $('<a href="#min">X</a>');
              var expand = function (evt) {
                n.empty();
                n.text(fulltext);
                n.append(m);
                evt.stopPropagation();
                evt.stopImmediatePropagation();
                evt.preventDefault();
              }
              var minimize = function (evt) {
                n.empty();
                n.text(mintext);
                // For some reason the old element's handler won't fire after removed and added again.
                e = $('<a href="#expand">...</a>');
                e.click(expand);
                n.append(e);
                evt.stopPropagation();
                evt.stopImmediatePropagation();
                evt.preventDefault();
              }
              e.click(expand);
              n.click(minimize);
              n.text(mintext);
              n.append(e)
            }
            return n;
          }
        }
        var elem = render(value);

        elem.find("dd:has(dl)").hide().prev("dt").addClass("collapsed");
        elem.find("dd:not(:has(dl))").addClass("inline").prev().addClass("inline");
        elem.find("dt.collapsed").click(function() {
          $(this).toggleClass("collapsed").next().toggle();
        });

        return elem;
      },

      addAttribute: function() {
        var attrName = "unnamed";
        var attrIdx = 1;
        while ($.riak.entry.hasOwnProperty(attrName)) {
          attrName = "unnamed " + attrIdx++;
        }
        $.riak.entry[attrName] = null;
        var row = $.riak.addRowForAttr(attrName);
        $.riak.isDirty = true;
        row.find("th b").dblclick();
      },

      addLink: function() {
        var uri = "/riak/BUCKET/KEY";
        var attrIdx = 1;
        while ($.riak.links.hasOwnProperty(uri)) {
          uri = "/riak/BUCKET/KEY" + attrIdx++;
        }
        $.riak.links[uri] = null;
        var row = $.riak.addRowForLink(uri);
        $.riak.isDirty = true;
        row.find("th b").dblclick();
      },

      addRowForLink: function(uri, tag) {
        var row = $("<tr><th class=\"key linkkey\"></th><td></td></tr>")
          .find("th").append($("<b></b>").text(uri)).end()
          .appendTo("#linkTable");
        row.find("td").append(tag);
        $.riak._initLinkUri(row, uri);
        $.riak._initLinkTag(row, uri);
	$(".content tr").removeClass("odd").filter(":odd").addClass("odd");
        var bucketuri = uri.replace("/riak/", "").replace(" ", "");
        row.find("th").append($("<a href='./entry.html?"+bucketuri+"'>open</>"));
	row.find("a").css("display", "inline");
        return row;
      },

      _initLinkUri: function(row, uri) {
        row.data("name", uri);

        var cell = row.find("th");

        $("<button type='button' class='delete' title='Delete Link'></button>").click(function() {
          delete $.riak.links[uri];
          row.remove();
          $.riak.isDirty = true;
          $(".content tr").removeClass("odd").filter(":odd").addClass("odd");
        }).prependTo(cell);

        cell.find("b").makeEditable({allowEmpty: false,
          accept: function(newUri, oldUri) {
            $.riak.links[newUri] = $.riak.links[oldUri];
            delete $.riak.links[oldUri];
            row.data("name", newUri);
            $(this).text(newUri);
            $.riak.isDirty = true;
          },
          begin: function() {
            row.find("th button.delete").hide();
            return true;
          },
          end: function(keyCode) {
            row.find("th button.delete").show();
            if (keyCode == 9) { // tab, move to editing the value
              row.find("td").dblclick();
            }
          },
          validate: function(newUri, oldUri) {
            $("div.error", this).remove();
            if (newUri != oldUri && $.riak.links[newUri] !== undefined) {
              $("<div class='error'>Already have an link with that uri.</div>")
                .appendTo(this);
              return false;
            }
            return true;
          }
        });
      },

      _initEditableEntryKey: function() {
        $("#key").makeEditable({allowEmpty: false,
          accept: function(newKey, oldKey) {
            if (newKey != oldKey) {
              $.riak.oldKey = oldKey;
              $.riak.key = newKey;
            }
          },
          end: function() {
            $(this).html($.riak.key);
          },
          populate: function(value) { return $.riak.key; },
        });
      },

      _initLinkTag: function(row, uri) {
        row.find("td").makeEditable({acceptOnBlur: false, allowEmpty: true,
          createInput: function(value) {
            value = $.riak.links[row.data("name")];
            var elem = $(this);
            return $("<input type='text' spellcheck='false'>");
          },
          end: function() {
            $(this).children().remove();
            $(this).append($.riak.links[row.data("name")]);
          },
          accept: function(newValue) {
            var uri = row.data("name");
            $.riak.links[uri] = newValue;
            $.riak.isDirty = true;
          },
          populate: function(value) {
            return $.riak.links[row.data("name")];
          },
          validate: function(value) {
            $("div.error", this).remove();
            return true;
          }
        });
      },

    });

  $.fn.enableTabInsertion = function(chars) {
    chars = chars || "\t";
    var width = chars.length;
    return this.keydown(function(evt) {
      if (evt.keyCode == 9) {
        var v = this.value;
        var start = this.selectionStart;
        var scrollTop = this.scrollTop;
        if (start !== undefined) {
          this.value = v.slice(0, start) + chars + v.slice(start);
          this.selectionStart = this.selectionEnd = start + width;
        } else {
          document.selection.createRange().text = chars;
          this.caretPos += width;
        }
        return false;
      }
    });
  }
})(jQuery);
