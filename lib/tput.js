/**
 * Tput for node.js
 * Copyright (c) 2013, Christopher Jeffrey (MIT License)
 * https://github.com/chjj/blessed
 */

// Resources:
//   $ man term
//   $ man terminfo
//   http://invisible-island.net/ncurses/man/term.5.html
//   https://en.wikipedia.org/wiki/Terminfo

/**
 * Modules
 */

var assert = require('assert')
  , fs = require('fs');

/**
 * Tput
 */

function Tput(term) {
  if (!(this instanceof Tput)) {
    return new Tput(term);
  }

  this.term = term;
  this.data = null;
  this.info = {};
}

Tput.prototype.readTermInfo = function() {
  if (this.data) return;

  var file = '/usr/share/terminfo/'
    + this.term[0]
    + '/'
    + this.term;

  this.data = fs.readFileSync(file);
  this.info = this.parseTermInfo(this.data);

  return this.info;
};

Tput.prototype.parseTermInfo = function(data) {
  var info = {}
    , l = data.length
    , i = 0;

  var h = info.header = {
    dataSize: data.length,
    headerSize: 12,
    magicNumber: (data[1] << 8) | data[0],
    namesSize: (data[3] << 8) | data[2],
    boolCount: (data[5] << 8) | data[4],
    numCount: (data[7] << 8) | data[6],
    strCount: (data[9] << 8) | data[8],
    strTableSize: (data[11] << 8) | data[10]
  };

  h.total = h.headerSize
    + h.namesSize
    + h.boolCount
    + h.numCount * 2
    + h.strCount * 2
    + h.strTableSize;

  i = h.headerSize;

  // Names Section
  var names = data.toString('ascii', i, i + h.namesSize - 1)
    , parts = names.split('|')
    , name = parts[0]
    , desc = parts.slice(1).join('|');

  info.name = name;
  info.desc = desc;

  i += h.namesSize - 1;

  // Names is nul-terminated.
  assert.equal(data[i], 0);
  i++;

  // Booleans Section
  // One byte for each flag
  // Same order as <term.h>
  info.bools = {};
  l = i + h.boolCount;
  var o = 0, b;
  for (; i < l; i++) {
    b = Tput.bools[o++] || 'OFFSET: ' + (o - 1);
    info.bools[b] = !!data[i];
  }

  // Null byte in between to make sure numbers begin on an even byte.
  if (i % 2) {
    assert.equal(data[i], 0);
    i++;
  }

  // Numbers Section
  info.numbers = {};
  l = i + h.numCount * 2;
  var o = 0, n;
  for (; i < l; i += 2) {
    n = Tput.numbers[o++] || 'OFFSET: ' + (o - 1);
    if (data[i + 1] === 0377 && data[i] === 0377) {
      info.numbers[n] = -1;
    } else {
      info.numbers[n] = (data[i + 1] << 8) | data[i];
    }
  }

  // Strings Section
  info.strings = {};
  l = i + h.strCount * 2;
  var o = 0, s;
  for (; i < l; i += 2) {
    s = Tput.strings[o++] || 'OFFSET: ' + (o - 1);
    if (data[i + 1] === 0377 && data[i] === 0377) {
      info.strings[s] = -1;
    } else {
      info.strings[s] = (data[i + 1] << 8) | data[i];
    }
  }

  // String Table
  Object.keys(info.strings).forEach(function(key) {
    if (info.strings[key] === -1) {
      delete info.strings[key];
      return;
    }

    var s = i + info.strings[key]
      , j = s;

    while (data[j]) j++;

    if (s >= data.length || j > data.length) {
      delete info.strings[key];
      return;
    }

    info.strings[key] = data.toString('ascii', s, j);
  });

  // Extended Header
  if (this.extended) {
    i += h.strTableSize + 1; // offset?
    l = data.length;
    if (i < l) {
      info.extended = this.parseExtended(data.slice(i));
      Object.keys(info.extended).forEach(function(key) {
        info[key].extended = info.extended[key];
      });
      delete info.extended;
    }
  }

  return info;
};

Tput.prototype.parseExtended = function(data) {
  var info = {}
    , l = data.length
    , i = 0;

  var h = info.header = {
    dataSize: data.length,
    headerSize: 10,
    boolCount: (data[i + 1] << 8) | data[i + 0],
    numCount: (data[i + 3] << 8) | data[i + 2],
    strCount: (data[i + 5] << 8) | data[i + 4],
    strTableSize: (data[i + 7] << 8) | data[i + 6],
    lastStrTableOffset: (data[i + 9] << 8) | data[i + 8]
  };

  h.total = h.headerSize
    + h.boolCount
    + h.numCount * 2
    + h.strCount * 2
    + h.strTableSize;

  i = h.headerSize;

  // Booleans Section
  // One byte for each flag
  // Same order as <term.h>
  info.bools = {};
  l = i + h.boolCount;
  var o = 36 + 1, b;
  for (; i < l; i++) {
    b = Tput.bools[o++] || 'OFFSET: ' + (o - 1);
    info.bools[b] = !!data[i];
  }

  // Null byte in between to make sure numbers begin on an even byte.
  if (i % 2) {
    assert.equal(data[i], 0);
    i++;
  }

  // Numbers Section
  info.numbers = {};
  l = i + h.numCount * 2;
  var o = 32 + 1, n;
  for (; i < l; i += 2) {
    n = Tput.numbers[o++] || 'OFFSET: ' + (o - 1);
    if (data[i + 1] === 0377 && data[i] === 0377) {
      info.numbers[n] = -1;
    } else {
      info.numbers[n] = (data[i + 1] << 8) | data[i];
    }
  }

  // Strings Section
  info.strings = {};
  l = i + h.strCount * 2;
  var o = 393 + 1, s;
  for (; i < l; i += 2) {
    s = Tput.strings[o++] || 'OFFSET: ' + (o - 1);
    if (data[i + 1] === 0377 && data[i] === 0377) {
      info.strings[s] = -1;
    } else {
      info.strings[s] = (data[i + 1] << 8) | data[i];
    }
  }

  // String Table
  Object.keys(info.strings).forEach(function(key) {
    if (info.strings[key] === -1) {
      delete info.strings[key];
      return;
    }

    var s = i + info.strings[key]
      , j = s;

    while (data[j]) j++;

    if (s >= data.length || j > data.length) {
      delete info.strings[key];
      return;
    }

    info.strings[key] = data.toString('ascii', s, j);
  });

  return info;
};

Tput.prototype.invoke = function(key, prefix, params, suffix) {
  var self = this;
  if (!this.info.all) {
    this.info.all = {};
    Object.keys(info.bools).forEach(function(key) {
      self.info.all[key] = info.bools;
    });
    Object.keys(info.numbers).forEach(function(key) {
      self.info.all[key] = info.numbers;
    });
    Object.keys(info.strings).forEach(function(key) {
      self.info.all[key] = info.strings;
    });
  }

  var val = this.info.all[key];
  if (val == null) return;

  switch (typeof val) {
    case 'boolean':
      val = val ? 'true' : 'false';
      break;
    case 'number':
      //val = val === -1 ? '' : val + '';
      val = val + '';
      break;
    case 'string':
      // e.g.
      // set_attributes: '%?%p9%t\u001b(0%e\u001b(B%;\u001b[0%?%p6%t;1%;%?%p2%t;4%;%?%p1%p3%|%t;7%;%?%p4%t;5%;%?%p7%t;8%;m',
      // cursor_address: '\u001b[%i%p1%d;%p2%dH',
      // column_address: '\u001b[%i%p1%dG',
      // change_scroll_region: '\u001b[%i%p1%d;%p2%dr',
        // CSI Ps ; Ps r
        // CSI ? Pm r

      var code = 'var dyn = {}, stat = {}, stack = []; out.push("';

      // man terminfo, around line 940

      // '\e' -> ^[
      val = val.replace(/\\e/gi, '\x1b');

      // '^A' -> ^A
      val = val.replace(/\^(.)/gi, function(_, ch) { // case-insensitive?
        switch (ch) {
          case '@':
            return '\x00';
          case 'A':
            return '\x01';
          case 'B':
            return '\x02';
          case 'C':
            return '\x03';
          case 'D':
            return '\x04';
          case 'E':
            return '\x05';
          case 'F':
            return '\x06';
          case 'G':
            return '\x07';
          case 'H':
            return '\x08';
          case 'I':
            return '\x09'; // \t
          case 'J':
            return '\x0a'; // \n
          case 'K':
            return '\x0b';
          case 'L':
            return '\x0c';
          case 'M':
            return '\x0d';
          case 'N':
            return '\x0e';
          case 'O':
            return '\x0f';
          case 'P':
            return '\x10';
          case 'Q':
            return '\x11';
          case 'R':
            return '\x12';
          case 'S':
            return '\x13';
          case 'T':
            return '\x14';
          case 'U':
            return '\x15';
          case 'V':
            return '\x16';
          case 'W':
            return '\x17';
          case 'X':
            return '\x18';
          case 'Y':
            return '\x19';
          case 'Z':
            return '\x1a';
          case '\\':
            return '\x1c';
          case '^':
            return '\x1e';
          case '_':
            return '\x1f';
          case '[':
            return '\x1b';
          case ']':
            return '\x1d';
          case '?':
            return '\x7f';
        }
      });

      // '\n' -> \n
      // '\r' -> \r
      // '\0' -> \200 (special case)
      val = val.replace(/\\([nlrtbfs\^\\,:0])/g, function(_, ch) {
        switch (ch) {
          case 'n':
            return '\n';
          case 'l':
            return '\l';
          case 'r':
            return '\r';
          case 't':
            return '\t';
          case 'b':
            return '\b';
          case 'f':
            return '\f';
          case 's':
            return '\s';
          case '\\':
            return '\\';
          case ',':
            return ',';
          case ';':
            return ';';
          case '0':
            //return '\0';
            return '\200';
        }
      });

      // 3 octal digits -> character
      val = val.replace(/\\(\d\d\d)/g, function(_, ch) {
        return String.fromCharCode(parseInt(ch, 8));
      });

      // $<5> -> padding
      val = val.replace(/\$<(\d+)>(\*|\/)/g, function(_, ch, opt) {
        // code += '';
        // TODO
        return '';
        return Array(+ch + 1).join(' '); // "padding" characters?
      });

      // man terminfo, around page 1034
      // %%   outputs `%'
      val = val.replace(/%%/g, '%');

      // %[[:]flags][width[.precision]][doxXs]
      //   as in printf, flags are [-+#] and space.  Use a `:' to allow the
      //   next character to be a `-' flag, avoiding interpreting "%-" as an
      //   operator.
      val = val.replace(/%(?:(:)?([\-+# ]+)?)(?:(\d+)(\.\d+)?)?([doxXs])?/g, function() {
        // TODO
        return '';
      });

      // %c   print pop() like %c in printf
      val = val.replace(/%c/g, function() {
        // code += 'out += stack.pop()'; // TODO: FORMAT
        // TODO
        return '';
      });

      // %s   print pop() like %s in printf
      val = val.replace(/%s/g, function() {
        // code += 'out += stack.pop()'; // TODO: FORMAT
        // TODO
        return '';
      });

      // %p[1-9]
      //   push i'th parameter
      val = val.replace(/%p([1-9])/g, function(_, i) {
        // code += 'params[i]';
        return params[i] || '';
      });

      // %P[a-z]
      //   set dynamic variable [a-z] to pop()
      val = val.replace(/%P([a-z])/g, function(_, v) {
        // code += 'dyn[' + v + '] = stack.pop()';
        // TODO
        return '';
      });

      // %g[a-z]
      //   get dynamic variable [a-z] and push it
      val = val.replace(/%g([a-z])/g, function(_, v) {
        // code += '(stack.push(dyn[' + v + ']), data[' + v + '])';
        // TODO
        return '';
      });

      // %P[A-Z]
      //   set static variable [a-z] to pop()
      val = val.replace(/%P([A-Z])/g, function(_, v) {
        // code += 'stat[' + v + '] = stack.pop()';
        // TODO
        return '';
      });

      // %g[A-Z]
      //   get static variable [a-z] and push it

      //   The  terms  "static"  and  "dynamic" are misleading.  Historically,
      //   these are simply two different sets of variables, whose values are
      //   not reset between calls to tparm.  However, that fact is not
      //   documented in other implementations.  Relying on it will adversely
      //   impact portability to other implementations.

      val = val.replace(/%g([A-Z])/g, function(_, v) {
        // TODO
        return '';
      });

      // %'c' char constant c
      val = val.replace(/%'(\w)'/g, function(_, ch) {
        // code += '"' + ch + '"';
        // TODO
        return '';
      });

      // %{nn}
      //   integer constant nn
      val = val.replace(/%\{(\d+)\}/g, function(_, nn) {
        // code += '(' + ch + ')';
        // TODO
        return '';
      });

      // %l   push strlen(pop)
      val = val.replace(/%l/g, function() {
        // code += 'stack.push(stack.pop().length)';
        // TODO
        return '';
      });

      // %+ %- %* %/ %m
      //   arithmetic (%m is mod): push(pop() op pop())
      val = val.replace(/%([+\-*\/m])/g, function(_, op) {
        // code += 'stack.push(stack.pop() ' + op + ' stack.pop())';
        // TODO
        return '';
      });

      // %& %| %^
      //   bit operations (AND, OR and exclusive-OR): push(pop() op pop())
      val = val.replace(/%([&|\^])/g, function(_, op) {
        // code += 'stack.push(stack.pop() ' + op + ' stack.pop())';
        // TODO
        return '';
      });

      // %= %> %<
      //   logical operations: push(pop() op pop())
      val = val.replace(/%([=><])/g, function(_, op) {
        // code += 'stack.push(stack.pop() ' + op + ' stack.pop())';
        // TODO
        return '';
      });

      // %A, %O
      //   logical AND and OR operations (for conditionals)
      val = val.replace(/%([AO])/g, function(_, v) {
        // code += v === ' A ' ? ' && ' : ' || ';
        // TODO
        return '';
      });

      // %! %~
      //   unary operations (logical and bit complement): push(op pop())
      val = val.replace(/%([!~])/g, function(_, op) {
        // code += 'stack.push(' + op + 'stack.pop())';
        // TODO
        return '';
      });

      // %i   add 1 to first two parameters (for ANSI terminals)
      val = val.replace(/%i/g, function(_, v) {
        // code += '(params[0]++, params[1]++)';
        // TODO
        return '';
      });

      // %? expr %t thenpart %e elsepart %;
      //   This forms an if-then-else.  The %e elsepart is optional.  Usually
      //   the %? expr part pushes a value onto the stack, and %t pops it from
      //   the stack, testing if it is nonzero (true).  If it is zero (false),
      //   control passes to the %e (else) part.

      //   It is possible to form else-if's a la Algol 68:
      //   %? c1 %t b1 %e c2 %t b2 %e c3 %t b3 %e c4 %t b4 %e %;

      //   where ci are conditions, bi are bodies.

      //   Use the -f option of tic or infocmp to see the structure of
      //   if-then-else's.  Some strings, e.g., sgr can be very complicated when
      //   written on one line.  The -f option splits the string into lines with
      //   the parts indented.
      //val = val.replace(/%\?(.+?)%t(.+?)%e(.+?)%;/g, function(_, expr, thenpart, elsepart) {
      //  // TODO: Generate code:
      //  // code += ';if (' + parse(expr) + ') {' + out(thenpart) + '} else {' + out(elsepart) + '}';
      //  // TODO
      //  return '';
      //});

      val = val.replace(/%\?/g, function(_, expr, thenpart, elsepart) {
        // code += ';if (';
        // TODO
        return '';
      });

      val = val.replace(/%t/g, function(_, expr, thenpart, elsepart) {
        // code += ') {';
        // TODO
        return '';
      });

      val = val.replace(/%e/g, function(_, expr, thenpart, elsepart) {
        // code += '} else {';
        // TODO
        return '';
      });

      val = val.replace(/%;/g, function(_, expr, thenpart, elsepart) {
        // code += '}';
        // TODO
        return '';
      });

      // Binary  operations  are  in postfix form with the operands in the usual
      // order.  That is, to get x-5 one would use "%gx%{5}%-".  %P and %g vari‐
      // ables are persistent across escape-string evaluations.

      // Consider the HP2645, which, to get to row 3 and column 12, needs to be
      // sent \E&a12c03Y padded for 6 milliseconds.  Note that the order of the
      // rows and columns is inverted here, and that the row and column are
      // printed as two digits.  Thus its cup capability is
      // “cup=6\E&%p2%2dc%p1%2dY”.

      // The  Microterm  ACT-IV  needs  the  current  row  and  column  sent
      // preceded  by  a  ^T,  with  the  row  and column simply encoded in
      // binary, “cup=^T%p1%c%p2%c”.  Terminals which use “%c” need to be able
      // to backspace the cursor (cub1), and to move the cursor up one line
      // on the  screen (cuu1).  This is necessary because it is not always safe
      // to transmit \n ^D and \r, as the system may change or discard them.
      // (The library routines dealing with terminfo set tty modes so that tabs
      // are never expanded, so \t is safe to send.  This turns out to be
      // essential for  the  Ann Arbor 4080.)

      // A  final example is the LSI ADM-3a, which uses row and column offset
      // by a blank character, thus “cup=\E=%p1%' '%+%c%p2%' '%+%c”.  After
      // sending `\E=', this pushes the first parameter, pushes the ASCII value
      // for a space (32), adds them (pushing the sum on the stack in place  of
      // the  two previous  values)  and outputs that value as a character.
      // Then the same is done for the second parameter.  More complex
      // arithmetic is possible using the stack.

      //val = val.replace(/%p(\d+)?/g, function(_, n) {
      //  return params[i++] || '';
      //});

      break;
  }

  console.log(val);

  return val;
};

// Return alias if one exists.
Tput.prototype.alias = function(key) {
  switch (key) {
    case 'no_esc_ctlc': // bool
      return 'beehive_glitch';
    case 'dest_tabs_magic_smso': // bool
      return 'teleray_glitch';
    case 'micro_col_size': // num
      return 'micro_char_size';
  }
};

Tput.prototype.setupAliases = function(info) {
  var self = this;
  Object.keys(info).forEach(function(name) {
    var obj = info[name];
    Object.keys(obj).forEach(function(key) {
      var alias = self.alias(key);
      if (alias) obj[alias] = obj[key];
    });
  });
};

Tput.prototype.colors = function() {
};

Tput.bools = [
  'auto_left_margin',
  'auto_right_margin',
  'no_esc_ctlc',
  'ceol_standout_glitch',
  'eat_newline_glitch',
  'erase_overstrike',
  'generic_type',
  'hard_copy',
  'has_meta_key',
  'has_status_line',
  'insert_null_glitch',
  'memory_above',
  'memory_below',
  'move_insert_mode',
  'move_standout_mode',
  'over_strike',
  'status_line_esc_ok',
  'dest_tabs_magic_smso',
  'tilde_glitch',
  'transparent_underline',
  'xon_xoff',
  'needs_xon_xoff',
  'prtr_silent',
  'hard_cursor',
  'non_rev_rmcup',
  'no_pad_char',
  'non_dest_scroll_region',
  'can_change',
  'back_color_erase',
  'hue_lightness_saturation',
  'col_addr_glitch',
  'cr_cancels_micro_mode',
  'has_print_wheel',
  'row_addr_glitch',
  'semi_auto_right_margin',
  'cpi_changes_res',
  'lpi_changes_res',

  // #ifdef __INTERNAL_CAPS_VISIBLE
  'backspaces_with_bs',
  'crt_no_scrolling',
  'no_correctly_working_cr',
  'gnu_has_meta_key',
  'linefeed_is_newline',
  'has_hardware_tabs',
  'return_does_clr_eol'
];

Tput.numbers = [
  'columns',
  'init_tabs',
  'lines',
  'lines_of_memory',
  'magic_cookie_glitch',
  'padding_baud_rate',
  'virtual_terminal',
  'width_status_line',
  'num_labels',
  'label_height',
  'label_width',
  'max_attributes',
  'maximum_windows',
  'max_colors',
  'max_pairs',
  'no_color_video',
  'buffer_capacity',
  'dot_vert_spacing',
  'dot_horz_spacing',
  'max_micro_address',
  'max_micro_jump',
  'micro_col_size',
  'micro_line_size',
  'number_of_pins',
  'output_res_char',
  'output_res_line',
  'output_res_horz_inch',
  'output_res_vert_inch',
  'print_rate',
  'wide_char_size',
  'buttons',
  'bit_image_entwining',
  'bit_image_type',

  // #ifdef __INTERNAL_CAPS_VISIBLE
  'magic_cookie_glitch_ul',
  'carriage_return_delay',
  'new_line_delay',
  'backspace_delay',
  'horizontal_tab_delay',
  'number_of_function_keys'
];

Tput.strings = [
  'back_tab',
  'bell',
  'carriage_return',
  'change_scroll_region',
  'clear_all_tabs',
  'clear_screen',
  'clr_eol',
  'clr_eos',
  'column_address',
  'command_character',
  'cursor_address',
  'cursor_down',
  'cursor_home',
  'cursor_invisible',
  'cursor_left',
  'cursor_mem_address',
  'cursor_normal',
  'cursor_right',
  'cursor_to_ll',
  'cursor_up',
  'cursor_visible',
  'delete_character',
  'delete_line',
  'dis_status_line',
  'down_half_line',
  'enter_alt_charset_mode',
  'enter_blink_mode',
  'enter_bold_mode',
  'enter_ca_mode',
  'enter_delete_mode',
  'enter_dim_mode',
  'enter_insert_mode',
  'enter_secure_mode',
  'enter_protected_mode',
  'enter_reverse_mode',
  'enter_standout_mode',
  'enter_underline_mode',
  'erase_chars',
  'exit_alt_charset_mode',
  'exit_attribute_mode',
  'exit_ca_mode',
  'exit_delete_mode',
  'exit_insert_mode',
  'exit_standout_mode',
  'exit_underline_mode',
  'flash_screen',
  'form_feed',
  'from_status_line',
  'init_1string',
  'init_2string',
  'init_3string',
  'init_file',
  'insert_character',
  'insert_line',
  'insert_padding',
  'key_backspace',
  'key_catab',
  'key_clear',
  'key_ctab',
  'key_dc',
  'key_dl',
  'key_down',
  'key_eic',
  'key_eol',
  'key_eos',
  'key_f0',
  'key_f1',
  'key_f10',
  'key_f2',
  'key_f3',
  'key_f4',
  'key_f5',
  'key_f6',
  'key_f7',
  'key_f8',
  'key_f9',
  'key_home',
  'key_ic',
  'key_il',
  'key_left',
  'key_ll',
  'key_npage',
  'key_ppage',
  'key_right',
  'key_sf',
  'key_sr',
  'key_stab',
  'key_up',
  'keypad_local',
  'keypad_xmit',
  'lab_f0',
  'lab_f1',
  'lab_f10',
  'lab_f2',
  'lab_f3',
  'lab_f4',
  'lab_f5',
  'lab_f6',
  'lab_f7',
  'lab_f8',
  'lab_f9',
  'meta_off',
  'meta_on',
  'newline',
  'pad_char',
  'parm_dch',
  'parm_delete_line',
  'parm_down_cursor',
  'parm_ich',
  'parm_index',
  'parm_insert_line',
  'parm_left_cursor',
  'parm_right_cursor',
  'parm_rindex',
  'parm_up_cursor',
  'pkey_key',
  'pkey_local',
  'pkey_xmit',
  'print_screen',
  'prtr_off',
  'prtr_on',
  'repeat_char',
  'reset_1string',
  'reset_2string',
  'reset_3string',
  'reset_file',
  'restore_cursor',
  'row_address',
  'save_cursor',
  'scroll_forward',
  'scroll_reverse',
  'set_attributes',
  'set_tab',
  'set_window',
  'tab',
  'to_status_line',
  'underline_char',
  'up_half_line',
  'init_prog',
  'key_a1',
  'key_a3',
  'key_b2',
  'key_c1',
  'key_c3',
  'prtr_non',
  'char_padding',
  'acs_chars',
  'plab_norm',
  'key_btab',
  'enter_xon_mode',
  'exit_xon_mode',
  'enter_am_mode',
  'exit_am_mode',
  'xon_character',
  'xoff_character',
  'ena_acs',
  'label_on',
  'label_off',
  'key_beg',
  'key_cancel',
  'key_close',
  'key_command',
  'key_copy',
  'key_create',
  'key_end',
  'key_enter',
  'key_exit',
  'key_find',
  'key_help',
  'key_mark',
  'key_message',
  'key_move',
  'key_next',
  'key_open',
  'key_options',
  'key_previous',
  'key_print',
  'key_redo',
  'key_reference',
  'key_refresh',
  'key_replace',
  'key_restart',
  'key_resume',
  'key_save',
  'key_suspend',
  'key_undo',
  'key_sbeg',
  'key_scancel',
  'key_scommand',
  'key_scopy',
  'key_screate',
  'key_sdc',
  'key_sdl',
  'key_select',
  'key_send',
  'key_seol',
  'key_sexit',
  'key_sfind',
  'key_shelp',
  'key_shome',
  'key_sic',
  'key_sleft',
  'key_smessage',
  'key_smove',
  'key_snext',
  'key_soptions',
  'key_sprevious',
  'key_sprint',
  'key_sredo',
  'key_sreplace',
  'key_sright',
  'key_srsume',
  'key_ssave',
  'key_ssuspend',
  'key_sundo',
  'req_for_input',
  'key_f11',
  'key_f12',
  'key_f13',
  'key_f14',
  'key_f15',
  'key_f16',
  'key_f17',
  'key_f18',
  'key_f19',
  'key_f20',
  'key_f21',
  'key_f22',
  'key_f23',
  'key_f24',
  'key_f25',
  'key_f26',
  'key_f27',
  'key_f28',
  'key_f29',
  'key_f30',
  'key_f31',
  'key_f32',
  'key_f33',
  'key_f34',
  'key_f35',
  'key_f36',
  'key_f37',
  'key_f38',
  'key_f39',
  'key_f40',
  'key_f41',
  'key_f42',
  'key_f43',
  'key_f44',
  'key_f45',
  'key_f46',
  'key_f47',
  'key_f48',
  'key_f49',
  'key_f50',
  'key_f51',
  'key_f52',
  'key_f53',
  'key_f54',
  'key_f55',
  'key_f56',
  'key_f57',
  'key_f58',
  'key_f59',
  'key_f60',
  'key_f61',
  'key_f62',
  'key_f63',
  'clr_bol',
  'clear_margins',
  'set_left_margin',
  'set_right_margin',
  'label_format',
  'set_clock',
  'display_clock',
  'remove_clock',
  'create_window',
  'goto_window',
  'hangup',
  'dial_phone',
  'quick_dial',
  'tone',
  'pulse',
  'flash_hook',
  'fixed_pause',
  'wait_tone',
  'user0',
  'user1',
  'user2',
  'user3',
  'user4',
  'user5',
  'user6',
  'user7',
  'user8',
  'user9',
  'orig_pair',
  'orig_colors',
  'initialize_color',
  'initialize_pair',
  'set_color_pair',
  'set_foreground',
  'set_background',
  'change_char_pitch',
  'change_line_pitch',
  'change_res_horz',
  'change_res_vert',
  'define_char',
  'enter_doublewide_mode',
  'enter_draft_quality',
  'enter_italics_mode',
  'enter_leftward_mode',
  'enter_micro_mode',
  'enter_near_letter_quality',
  'enter_normal_quality',
  'enter_shadow_mode',
  'enter_subscript_mode',
  'enter_superscript_mode',
  'enter_upward_mode',
  'exit_doublewide_mode',
  'exit_italics_mode',
  'exit_leftward_mode',
  'exit_micro_mode',
  'exit_shadow_mode',
  'exit_subscript_mode',
  'exit_superscript_mode',
  'exit_upward_mode',
  'micro_column_address',
  'micro_down',
  'micro_left',
  'micro_right',
  'micro_row_address',
  'micro_up',
  'order_of_pins',
  'parm_down_micro',
  'parm_left_micro',
  'parm_right_micro',
  'parm_up_micro',
  'select_char_set',
  'set_bottom_margin',
  'set_bottom_margin_parm',
  'set_left_margin_parm',
  'set_right_margin_parm',
  'set_top_margin',
  'set_top_margin_parm',
  'start_bit_image',
  'start_char_set_def',
  'stop_bit_image',
  'stop_char_set_def',
  'subscript_characters',
  'superscript_characters',
  'these_cause_cr',
  'zero_motion',
  'char_set_names',
  'key_mouse',
  'mouse_info',
  'req_mouse_pos',
  'get_mouse',
  'set_a_foreground',
  'set_a_background',
  'pkey_plab',
  'device_type',
  'code_set_init',
  'set0_des_seq',
  'set1_des_seq',
  'set2_des_seq',
  'set3_des_seq',
  'set_lr_margin',
  'set_tb_margin',
  'bit_image_repeat',
  'bit_image_newline',
  'bit_image_carriage_return',
  'color_names',
  'define_bit_image_region',
  'end_bit_image_region',
  'set_color_band',
  'set_page_length',
  'display_pc_char',
  'enter_pc_charset_mode',
  'exit_pc_charset_mode',
  'enter_scancode_mode',
  'exit_scancode_mode',
  'pc_term_options',
  'scancode_escape',
  'alt_scancode_esc',
  'enter_horizontal_hl_mode',
  'enter_left_hl_mode',
  'enter_low_hl_mode',
  'enter_right_hl_mode',
  'enter_top_hl_mode',
  'enter_vertical_hl_mode',
  'set_a_attributes',
  'set_pglen_inch',

  // #ifdef __INTERNAL_CAPS_VISIBLE
  'termcap_init2',
  'termcap_reset',
  'linefeed_if_not_lf',
  'backspace_if_not_bs',
  'other_non_function_keys',
  'arrow_key_map',
  'acs_ulcorner',
  'acs_llcorner',
  'acs_urcorner',
  'acs_lrcorner',
  'acs_ltee',
  'acs_rtee',
  'acs_btee',
  'acs_ttee',
  'acs_hline',
  'acs_vline',
  'acs_plus',
  'memory_lock',
  'memory_unlock',
  'box_chars_1'
];

Object.keys(Tput.prototype).forEach(function(key) {
  if (key === 'readTermInfo') return;
  var method = Tput.prototype[key];
  Tput.prototype[key] = function() {
    this.readTermInfo();
    return method.apply(this, arguments);
  };
});

module.exports = Tput;