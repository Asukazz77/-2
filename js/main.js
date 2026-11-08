/* 豆苗实验室 · main.js
 *
 * 三个实验的交互都在这个文件里。没有依赖、没有构建步骤，
 * 改完直接刷新就能看到效果。
 *
 * 进度只存在内存里：刷新页面等于从头再来。这样孩子拿去玩不会
 * 留下半截状态，也省得处理 localStorage 在 file:// 下的各种毛病。
 */

(function () {
  'use strict';

  // 没有 JS 时所有页会顺序铺开（见 main.css 里的 .no-js 规则）；
  // 脚本能跑了就把这个 class 摘掉，切成一次只显示一页
  document.documentElement.classList.remove('no-js');

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  // 三个实验各自的完成标记，决定解锁什么、毕业证打几个勾
  var done = { exp1: false, exp2: false, exp3: false };

  var FINDING = { exp1: 'find1', exp2: 'find2', exp3: 'find3' };


  // ---------------------------------------------------------------
  // 路由 + 解锁
  // ---------------------------------------------------------------

  function canEnter(id) {
    switch (id) {
      case 'exp2': return done.exp1;
      case 'exp3': return done.exp2;
      case 'cert': return done.exp3;
      default:     return true;
    }
  }

  var LOCK_MSG = {
    exp2: '先做完实验一的 4 关，实验二才会开。',
    exp3: '先把实验二的线索和题目都做完，实验三才会开。',
    cert: '三个实验都做完，才能领毕业证。'
  };

  var toastTimer = 0;

  function toast(msg) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-on'); }, 2800);
  }

  function go(id, quiet) {
    var page = document.getElementById(id);
    if (!page || !page.classList.contains('page')) return false;

    if (!canEnter(id)) {
      toast(LOCK_MSG[id] || '这一页还没开。');
      return false;
    }

    $$('.page').forEach(function (p) { p.classList.toggle('is-on', p === page); });
    $$('.tab').forEach(function (t) {
      t.setAttribute('aria-current', t.dataset.go === id ? 'true' : 'false');
    });

    // 带 #exp1 直接打开时浏览器会自己跳锚点，把标题顶到吸顶导航下面，
    // 所以下一帧再压一次
    window.scrollTo(0, 0);
    requestAnimationFrame(function () { window.scrollTo(0, 0); });

    try { history.replaceState(null, '', '#' + id); } catch (e) { /* file:// 下可能不让改 */ }

    var h = page.querySelector('h1, h2');
    if (h && !quiet) {
      h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: true });
    }
    return true;
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-go]');
    if (!el) return;
    e.preventDefault();
    go(el.dataset.go);
  });

  var tabBar = $('.tabs');
  if (tabBar) {
    tabBar.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var tabs = $$('.tab');
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length].focus();
    });
  }


// ---------------------------------------------------------------
  // 实验一：四位二进制，四关
  // 每个开关上面写它当前是 0 还是 1，下面写它的位权，
  // 底下一行实时算式把"怎么加出来的"摊开，不让人猜。
  // ---------------------------------------------------------------

  var bulbs = $$('.bulb');
  var sumOut = $('#sum');
  var eqTerms = $('#eqTerms');
  var taskList = $('#tasklist1');
  var goalBox = $('#goal1');
  var goalKick = $('#goalKick');
  var goalMain = $('#goalMain');
  var goalHint = $('#goalHint');

  var GOAL_HINT = {};

  var resetTimer = 0;
  var lastSum = -1;
  var lastGoalKey = '';

  function taskItems() { return taskList ? $$('li', taskList) : []; }

  // 让某个元素抖一下。先移除再加回，否则连续两次同样的变化不会重播
  function bump(el) {
    if (!el) return;
    el.classList.remove('is-bump');
    void el.offsetWidth;
    el.classList.add('is-bump');
  }

  function renderBits() {
    var total = 0;
    var lit = 0;
    var parts = [];

    bulbs.forEach(function (b) {
      var on = b.getAttribute('aria-pressed') === 'true';
      var weight = Number(b.dataset.bit);

      if (on) { total += weight; lit++; }

      b.querySelector('.bulb__val').textContent = on ? '1' : '0';
      parts.push('<i class="' + (on ? 'on' : '') + '">' + (on ? 1 : 0) + '</i>×' + weight);
    });

    eqTerms.innerHTML = parts.join(' + ');

    if (total !== lastSum) {
      lastSum = total;
      sumOut.textContent = total;
      bump(sumOut);
    }

    // 顺手看看有没有刚好凑中某一关
    var justDone = null;
    taskItems().forEach(function (li) {
      if (li.classList.contains('is-done')) return;
      // 只认第一道没做完的：乱拨出来的数不能点亮后面的关卡
      var firstOpen = taskItems().filter(function (x) { return !x.classList.contains('is-done'); })[0];
      if (li !== firstOpen) return;
      var goal = Number(li.dataset.goal);
      var needLit = li.dataset.exact ? Number(li.dataset.exact) : null;

      if (total === goal && (needLit === null || lit === needLit)) {
        li.classList.add('is-done');
        justDone = li;
      }
    });

    updateGoal();
    refresh();

    // 过关之后自动把开关清空，省得孩子自己一个个点灭
    if (justDone) {
      clearTimeout(resetTimer);
      resetTimer = setTimeout(function () {
        var allDone = taskItems().every(function (li) { return li.classList.contains('is-done'); });
        if (allDone) return;
        bulbs.forEach(function (b) {
          if (b.getAttribute('aria-pressed') === 'true') b.click();
        });
      }, 950);
    }
  }

  function updateGoal() {
    if (!goalBox) return;

    var items = taskItems();
    var undone = items.filter(function (li) { return !li.classList.contains('is-done'); });

    // 换了关才动 DOM；不然每次拨开关都会重写一遍，读屏软件会一直念
    var key = undone.length ? 'goal-' + undone[0].dataset.goal : 'all';
    if (key === lastGoalKey) return;
    lastGoalKey = key;

    if (!undone.length) {
      goalBox.classList.add('is-all');
      var tasksBox = $('.tasks');
      if (tasksBox) tasksBox.classList.add('is-all');
      goalKick.textContent = '四关都过了';
      goalMain.textContent = '全部完成';
      goalHint.textContent = '往下看看你发现了什么';
      // 四关都过了，这一页才算完成
      completeModule('exp1');
      return;
    }

    var li = undone[0];
    var n = items.indexOf(li) + 1;

    goalKick.textContent = '第 ' + n + ' 关 / 共 ' + items.length + ' 关';
    goalMain.innerHTML = '凑出 <b>' + li.dataset.goal + '</b>';
    goalHint.textContent = GOAL_HINT[li.dataset.goal] || '';

    bump(goalBox);
  }

  bulbs.forEach(function (b) {
    b.addEventListener('click', function () {
      var on = b.getAttribute('aria-pressed') === 'true';
      b.setAttribute('aria-pressed', on ? 'false' : 'true');
      renderBits();
    });
  });

  // ---------------------------------------------------------------
  // 实验二：四个特征 + 四道题
  // ---------------------------------------------------------------

  var FEATS = [
    ['f-ears', ['p-ear-l', 'p-ear-r']],
    ['f-whiskers', ['p-whiskers']],
    ['f-eyes', ['p-eyes']],
    ['f-tail', ['p-tail']]
  ];

  var CONF = [8, 26, 58, 84, 96];
  var SAY = ['我不确定这是什么', '有点眼熟，但不敢说', '有点像猫', '应该是猫吧', '是猫！'];

  var confFill = $('#confFill');
  var confNum = $('#confNum');
  var aiSay = $('#aiSay');
  var callout2 = $('#callout2');

  var featsDone = false;   // 四个特征至少勾齐过一次
    // 线索没勾满之前，题目先藏起来
    var quizEl = document.querySelector('.quiz');
    if (quizEl) quizEl.classList.toggle('is-ready', featsDone);
  var qs = $$('.q');
  var solved = 0;

  // 每道题答对之后补一句解释，写在数据里太散，索性放这儿
  var WHY = [
    '96% 只是它的把握，不是事实。它没见过的东西，它也会给个高分。',
    '线索太少，它就不敢肯定了。人只看到一只耳朵也知道是猫，它不行。',
    '长得不一样的猫，它可能一次都没见过，自然认不出来。',
    '多半是线索不够，或者它根本没学过这种东西。'
  ];

  function renderCat() {
    var n = 0;

    FEATS.forEach(function (pair) {
      var box = document.getElementById(pair[0]);
      var checked = box ? box.checked : false;

      if (checked) n++;

      pair[1].forEach(function (pid) {
        var el = document.getElementById(pid);
        if (!el) return;
        el.classList.toggle('on', checked);

        // 勾耳朵的时候让它抖一下，像刚听见声音
        if (checked && el.classList.contains('cat__ear')) {
          el.classList.remove('twitch');
          void el.offsetWidth;
          el.classList.add('twitch');
        }
      });
    });

    confFill.style.width = CONF[n] + '%';
    if (confNum.textContent !== '把握 ' + CONF[n] + '%') {
      confNum.textContent = '把握 ' + CONF[n] + '%';
      bump(confNum);
    }
    aiSay.textContent = SAY[n];

    // 这一步"算不算完成"要看当下：取消勾选就是退回到第一步，
    // 大字得重新放大回来，不能勾过一次就永远收着
    featsDone = (n === 4);

    if (callout2) {
      // 整个实验已经通过了，就让它一直收着；否则跟着勾选状态走
      callout2.classList.toggle('is-done', n === 4 || done.exp2);
    }

    tryFinish2();
    refresh();
  }

  FEATS.forEach(function (pair) {
    var box = document.getElementById(pair[0]);
    if (box) box.addEventListener('change', renderCat);
  });

  qs.forEach(function (q, qi) {
    var answer = Number(q.dataset.answer);
    var fb = $('.q__fb', q);

    $$('.opt', q).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (q.classList.contains('is-right')) return;

        if (Number(btn.dataset.pick) === answer) {
          q.classList.add('is-right');
          btn.classList.add('is-picked');
          $$('.opt', q).forEach(function (b) { b.disabled = true; });

          fb.textContent = '答对了。' + (WHY[qi] || '');
          fb.className = 'q__fb is-ok';

          solved++;
          tryFinish2();
          refresh();
        } else {
          btn.classList.add('is-wrong');
          fb.textContent = '再想想，这个不对。';
          fb.className = 'q__fb is-bad';
          setTimeout(function () { btn.classList.remove('is-wrong'); }, 600);
        }
      });
    });
  });

  function tryFinish2() {
    if (featsDone && solved === qs.length) completeModule('exp2');
  }


  // ---------------------------------------------------------------
  // 实验三：五封信
  // ---------------------------------------------------------------

  // 答错时把判断方法摊开，再点出这封信的可疑之处
  // 五封信各一句，顺序和页面上一致：红包 / 妈妈 / 客服 / 图书馆 / 爸爸
  var LETTER_HINT = [
    '要你点一个没见过的链接去领 666 元红包。天上不会掉钱。',
    '没有链接、没有要钱、没有要密码，发信的确实是你妈妈——三问都答「不」。',
    '它自称「游戏客服」，却要你把密码发过去。没有人需要你的密码。',
    '它让你点链接交罚款，还用「影响毕业」吓你。真罚款不会这样催。',
    '只是提醒你带数学本，没有链接、没有钱、没有密码，是你爸爸。'
  ];

  var letters = $$('.letter');

  letters.forEach(function (card) {
    var answer = card.dataset.answer;
    var fb = $('.letter__why', card);

    $$('[data-pick]', card).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (card.classList.contains('is-right')) return;

        if (btn.dataset.pick === answer) {
          card.classList.remove('is-wrong');
          card.classList.add('is-right');

          fb.textContent = '答对了。' + card.dataset.why;
          $$('[data-pick]', card).forEach(function (b) {
            b.disabled = true;
            b.classList.remove('is-wrong');
          });

          if ($$('.letter.is-right').length === letters.length) completeModule('exp3');
          refresh();
        } else {
          btn.classList.add('is-wrong');
          card.classList.remove('is-wrong');
          void card.offsetWidth;
          card.classList.add('is-wrong');

            fb.innerHTML = '<b>这封不是。</b>'
              + '<span class="letter__tip">' + (LETTER_HINT[letters.indexOf(card)] || '再读一遍，找找有没有链接、钱、密码。') + '</span>';

          setTimeout(function () { btn.classList.remove('is-wrong'); }, 700);
        }
      });
    });
  });


  // ---------------------------------------------------------------
  // 收尾：完成一个模块之后统一刷新界面
  // ---------------------------------------------------------------

  // 让宠物蹦一下；找不到元素就安静地什么都不做
  function happyHop() {
    var pet = $('#pet');
    if (!pet) return;
    pet.classList.remove('is-happy');
    void pet.offsetWidth;
    pet.classList.add('is-happy');
    setTimeout(function () { pet.classList.remove('is-happy'); }, 900);
  }

  function completeModule(key) {
    if (done[key]) return;
    done[key] = true;

    refresh();
    happyHop();

    var el = document.getElementById(FINDING[key]);
    if (!el) return;

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  }

  function setHint(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function refresh() {
    $$('.tab').forEach(function (t) {
      if (canEnter(t.dataset.go)) t.removeAttribute('data-locked');
      else t.setAttribute('data-locked', '1');
    });

    Object.keys(FINDING).forEach(function (k) {
      var el = document.getElementById(FINDING[k]);
      if (el) el.hidden = !done[k];
    });

    Object.keys(done).forEach(function (k) {
      var btn = $('#' + k + ' .btn--next');
      if (btn) btn.disabled = !done[k];

      var hint = $('#' + k + ' .lockhint');
      if (hint) hint.classList.toggle('is-off', done[k]);
    });

    var left1 = taskItems().filter(function (li) { return !li.classList.contains('is-done'); }).length;
    if (!done.exp1) setHint('hint1', '还有 ' + left1 + ' 关没做完，先做完再走。');

    var left2 = (featsDone ? 0 : 1) + (qs.length - solved);
    if (!done.exp2) setHint('hint2', '还有 ' + left2 + ' 步没做完。');

    var left3 = letters.length - $$('.letter.is-right').length;
    if (!done.exp3) setHint('hint3', '还有 ' + left3 + ' 封信没判断。');

    $$('.cert__list li').forEach(function (li) {
      li.dataset.done = done[li.dataset.key] ? '1' : '0';
    });
  }


  // ---------------------------------------------------------------
  // 毕业证
  // ---------------------------------------------------------------

  var certDate = $('#certDate');
  if (certDate) {
    var d = new Date();
    certDate.textContent = d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
  }

  var saveBtn = $('#saveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', function () {
      // 浏览器把页面标题当成另存 PDF 时的默认文件名，所以先临时换一个好认的
      var oldTitle = document.title;
      var nameEl = $('#certName');
      var who = nameEl ? (nameEl.value || '').trim() : '';

      document.title = '豆苗实验室-结业证明' + (who ? '-' + who : '');

      try {
        window.print();
      } finally {
        // 打印/另存窗口关掉之后把标题还原
        setTimeout(function () { document.title = oldTitle; }, 800);
      }
    });
  }

  var restartBtn = $('#restartBtn');
  if (restartBtn) {
    // 直接重载最省事，也不用一个个把状态清回去
    restartBtn.addEventListener('click', function () { location.reload(); });
  }


// ---------------------------------------------------------------
  // 常驻的小豆苗：能拖、会自己溜达、点一下能互动
  // ---------------------------------------------------------------

  var pet = $('#pet');
  var petBtn2 = $('#petBtn');
  var petPanel = $('#petPanel');
  var petSay = $('#petSay');
  var petHint = $('#petHint');
  var petChat = $('#petChat');
  var petClose = $('#petClose');
  var petTip = $('#petTip');
  var petBubble = $('#petBubble');

  // 闲聊用的句子，都挑具体的说，不要空话
  var CHATS = [
    '计算机里，一个 0 或一个 1，叫一个「位」。',
    '八个位绑在一起，叫一个「字节」，能表示 0 到 255。',
    '你手机里一张照片，大概有几百万个字节。',
    'AI 认东西，靠的是一条一条的线索，不是「看一眼就懂」。',
    '你敲的每一个字，进了电脑都变成 0 和 1。',
    '豆苗也是要晒太阳的——不过是你关机之后。'
  ];

  // 自己溜达时会嘀咕的句子
  var IDLE_TALK = [
    '今天也要做实验呀。',
    '你在看哪一页？',
    '我在这儿，有事叫我。',
    '0 和 1，够用了。',
    '站久了，腿有点麻。'
  ];

  var chatIndex = -1;
  var petX = 0;
  var petY = 0;
  var dragging = false;
  var dragMoved = false;
  var dragStart = null;
  var suppressClick = false;
  var roamTimer = 0;
  var talkTimer = 0;

  function petSize() {
    var r = pet.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }

  // 把位置夹在可视区里再写进 transform
  function setPetPos(x, y, animate) {
    var s = petSize();
    var maxX = window.innerWidth - s.w - 8;
    var maxY = window.innerHeight - s.h - 8;

    petX = Math.min(Math.max(8, x), Math.max(8, maxX));
    petY = Math.min(Math.max(8, y), Math.max(8, maxY));

    pet.style.transition = animate ? 'transform 1.05s cubic-bezier(.16,1,.3,1)' : 'none';
    pet.style.transform = 'translate(' + petX + 'px,' + petY + 'px)';
  }

  function placePet() {
    var s = petSize();
    setPetPos(window.innerWidth - s.w - 24, window.innerHeight - s.h - 24, false);
  }

  function currentPageId() {
    var page = $('.page.is-on');
    return page ? page.id : 'cover';
  }

  // 按当前进度算一句真正有用的提示
  function currentHint() {
    var id = currentPageId();

    if (id === 'cover') return '先点「开始做实验」，从第一关开始。';

    if (id === 'exp1') {
      var left = taskItems().filter(function (li) { return !li.classList.contains('is-done'); });
      if (!left.length) return '四关都过了，去实验二吧。';
      var li = left[0];
      var goal = li.dataset.goal;
      var recipe = {
        '3':  '只打开 1 和 2 这两个，加起来正好 3。',
        '15': '四个全打开——8、4、2、1 一个不落，就是 15。',
        '12': '打开 8 和 4，把 2 和 1 关上。',
        '9':  '打开 8 和 1；中间那两位不用管。'
      }[goal];
      if (lastSum === 0) return '这一关要 ' + goal + '。' + recipe;
      if (lastSum === Number(goal)) return '就是这个数！';
      var diff = Number(goal) - lastSum;
      if (diff > 0) return '现在是 ' + lastSum + '，离 ' + goal + ' 还差 ' + diff + '。' + recipe;
      return '现在是 ' + lastSum + '，比 ' + goal + ' 多了 ' + (-diff) + '，关掉一个再试试。';
    }

    if (id === 'exp2') {
      if (!featsDone) return '把耳朵、胡须、眼睛、尾巴四条线索都勾上，它会一条一条数给你看。';
      if (solved < qs.length) {
        // 题目能乱序点，提示要对准第一道还没答对的，不能拿"答对了几道"去推算
        var qi2 = 0;
        for (var k2 = 0; k2 < qs.length; k2++) {
          if (!qs[k2].classList.contains('is-right')) { qi2 = k2; break; }
        }
        return '从第 ' + (qi2 + 1) + ' 题往下做，答错可以再选。';
      }
      return '这一页做完了，去实验三吧。';
    }

    if (id === 'exp3') {
      var rest = letters.length - $$('.letter.is-right').length;
      if (!rest) return '五封信都判完了，去领证书吧。';
      // 指着第一封还没判的信说具体疑点，别讲空话
      var all3 = $$('.letter');
      var idx3 = -1;
      for (var i3 = 0; i3 < all3.length; i3++) {
        if (!all3[i3].classList.contains('is-right')) { idx3 = i3; break; }
      }
      if (idx3 < 0) return '五封都判完了，去领证书吧。';
      return '第 ' + (idx3 + 1) + ' 封。先问三句：他要我点链接吗？要我给钱或密码吗？这人我不认识吗？';
    }

    if (id === 'cert') return '三个实验都过了。写上名字，就能保存这张证书。';

    return '点上面的目录，可以换一个实验。';
  }

  // 头顶上冒一句小话，过几秒自己消失
  function sayBubble(text) {
    if (!petBubble) return;
    petBubble.textContent = text;
    petBubble.hidden = false;
    petBubble.classList.add('is-on');
    clearTimeout(talkTimer);
    talkTimer = setTimeout(function () {
      petBubble.classList.remove('is-on');
      setTimeout(function () { petBubble.hidden = true; }, 220);
    }, 2800);
  }

  var lastPetLine = '';

  // 摸一下：蹦一下 + 说句俏皮话。不管气泡开没开，这一个动作都成立。
  function petOnce() {
    var lines = ['嘿嘿，好痒。', '我最喜欢晒太阳了。', '再摸一下嘛。', '你的手好暖和。'];
    var next = Math.floor(Math.random() * lines.length);
    // 别连着说同一句
    if (lines[next] === lastPetLine) next = (next + 1) % lines.length;
    lastPetLine = lines[next];
    petSay.textContent = lastPetLine;
    if (petTip) petTip.hidden = true;
    happyHop();
  }

  function openPet() {
    if (!petPanel) return;
    if (petBubble) { petBubble.hidden = true; petBubble.classList.remove('is-on'); }

    petPanel.hidden = false;

    // 上面放不下就改成朝下开——绝不挪动宠物本身
    pet.classList.toggle('is-below', petY < petPanel.offsetHeight + 16);

    petBtn2.setAttribute('aria-expanded', 'true');
    petOnce();
    petHint.focus();
  }

  function closePet() {
    if (!petPanel || petPanel.hidden) return;
    petPanel.hidden = true;
    petBtn2.setAttribute('aria-expanded', 'false');
    petBtn2.focus();
  }

  // ---- 拖动 ----
  if (pet && petBtn2) {
    petBtn2.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      dragMoved = false;
      dragStart = { x: e.clientX, y: e.clientY, ox: petX, oy: petY };
      pet.classList.add('is-dragging');
      try { petBtn2.setPointerCapture(e.pointerId); } catch (err) {}
      clearTimeout(roamTimer);
    });

    petBtn2.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - dragStart.x;
      var dy = e.clientY - dragStart.y;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) dragMoved = true;
      if (!dragMoved) return;
      setPetPos(dragStart.ox + dx, dragStart.oy + dy, false);
    });

    petBtn2.addEventListener('pointerup', function (e) {
      if (!dragging) return;
      dragging = false;
      pet.classList.remove('is-dragging');
      try { petBtn2.releasePointerCapture(e.pointerId); } catch (err) {}

      if (dragMoved) {
        suppressClick = true;
        setTimeout(function () { suppressClick = false; }, 400);
        setPetPos(petX, petY, true);
        scheduleRoam();
      }
    });

    petBtn2.addEventListener('pointercancel', function () {
      dragging = false;
      pet.classList.remove('is-dragging');
      scheduleRoam();
    });
  }

  // ---- 点击（键盘 Enter/空格也走这里）----
  if (petBtn2 && petPanel) {
    petBtn2.addEventListener('click', function () {
      if (suppressClick) { suppressClick = false; return; }
      if (petPanel.hidden) openPet(); else petOnce();
    });

    petClose.addEventListener('click', closePet);

    petHint.addEventListener('click', function () {
      petSay.textContent = currentHint();
    });

    petChat.addEventListener('click', function () {
      var next = Math.floor(Math.random() * CHATS.length);
      if (next === chatIndex) next = (next + 1) % CHATS.length;
      chatIndex = next;
      petSay.textContent = CHATS[next];
    });

    document.addEventListener('click', function (e) {
      if (petPanel.hidden) return;
      if (e.target.closest('#pet')) return;
      closePet();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePet();
    });
  }

  // ---- 自己溜达 ----
  function canRoam() {
    if (!pet) return false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    return true;
  }

  function scheduleRoam() {
    clearTimeout(roamTimer);
    if (!canRoam()) return;
    roamTimer = setTimeout(function () {
      roamOnce();
      scheduleRoam();
    }, 5000 + Math.random() * 4500);
  }

  function roamOnce() {
    // 正在拖、面板开着、或者页面在打印，就别乱动
    if (dragging || (petPanel && !petPanel.hidden)) return;

    var s = petSize();
    var r = Math.random();

    if (r < 0.5) {
      // 横向挪一小段，像在走
      var span = Math.min(200, window.innerWidth * 0.24);
      var nx = petX + (Math.random() * 2 - 1) * span;
      pet.classList.add('is-walking');
      setPetPos(nx, petY, true);
      setTimeout(function () { pet.classList.remove('is-walking'); }, 1100);
    } else if (r < 0.7) {
      // 蹦一下
      pet.classList.add('is-happy');
      setTimeout(function () { pet.classList.remove('is-happy'); }, 900);
    } else if (r < 0.85) {
      // 左右张望
      pet.classList.toggle('is-flip');
    } else {
      // 自言自语
      sayBubble(IDLE_TALK[Math.floor(Math.random() * IDLE_TALK.length)]);
    }
  }

  window.addEventListener('resize', function () {
    if (!pet) return;
    setPetPos(petX, petY, false);
  });

  // 页面滚动时先淡下去，别挡着正文；停下来再亮回来
  var dimTimer = 0;
  window.addEventListener('scroll', function () {
    if (!pet || dragging) return;
    pet.classList.add('is-dim');
    clearTimeout(dimTimer);
    dimTimer = setTimeout(function () { pet.classList.remove('is-dim'); }, 650);
  }, { passive: true });


  // 「摸摸我」不是常驻标签：人一直不动，它才冒出来招呼一声；
  // 一旦有操作就收起来，之后靠自言自语自己热闹。
  var IDLE_MS = 12000;
  var idleTimer = 0;

  function resetIdle() {
    clearTimeout(idleTimer);
    if (petTip) petTip.hidden = true;
    idleTimer = setTimeout(function () {
      if (!pet || dragging || (petPanel && !petPanel.hidden)) return;
      if (petTip) petTip.hidden = false;
    }, IDLE_MS);
  }

  ['pointerdown', 'pointermove', 'wheel', 'keydown', 'scroll'].forEach(function (name) {
    window.addEventListener(name, resetIdle, { passive: true });
  });


  // 开场：封面那台电脑先说话，停五秒，再顺滑飞进右下角变成桌宠。
  // 带 ?nointro 参数或系统关了动效时不播，免得影响截图和测试。
  // 手机端：封面插画在首屏外，改用居中角色演同一套
  function runIntroSmall(intro, char, bubble) {
    var t = petBtn2.getBoundingClientRect();
    var W = window.innerWidth;
    var H = window.innerHeight;
    var w = Math.min(W * 0.6, 230);
    var sc = w / 240;
    var sx = (W - w) / 2;
    var sy = H * 0.3;

    char.style.display = 'block';
    intro.hidden = false;
    intro.style.opacity = '';   // 遮罩从首帧就在，不要再淡入
    document.body.classList.add('is-intro');
    char.style.transition = 'none';
    char.style.transform = 'translate(' + sx + 'px,' + sy + 'px) scale(' + sc + ')';
    char.style.opacity = '1';

    var bw = Math.min(W - 56, 260);
    bubble.style.width = bw + 'px';
    bubble.style.left = ((W - bw) / 2) + 'px';
    bubble.style.top = (sy + 258 * sc + 18) + 'px';
    bubble.style.opacity = '0';
    setTimeout(function () { bubble.style.opacity = '1'; }, 200);

    setTimeout(function () {
      bubble.style.opacity = '0';
      char.style.transition = 'transform .95s cubic-bezier(.16, 1, .3, 1)';
      char.style.transform = 'translate(' + t.left + 'px,' + t.top + 'px) scale(' + (t.width / 240) + ')';
      setTimeout(function () {
        intro.style.opacity = '0';
        setTimeout(function () { intro.hidden = true; }, 280);
        char.style.display = 'none';
        document.body.classList.remove('is-intro');
        placePet();
        pet.classList.remove('is-hidden');
        resetIdle();
      }, 980);
    }, 2000);
  }

function runIntro() {
    var intro = $('#intro');
    var char = $('#introChar');
    var bubble = $('#introBubble');
    var art = document.querySelector('.cover__art');
    var mon = document.querySelector('.sc-monitor');

    if (!intro || !bubble || !art || !mon || !pet) return;
    if (currentPageId() !== 'cover') return;
    if (/[?&]nointro/.test(location.search)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    if (window.innerWidth < 900) return runIntroSmall(intro, char, bubble);

    var a = art.getBoundingClientRect();
    var m = mon.getBoundingClientRect();
    var t = petBtn2.getBoundingClientRect();
    if (!a.width || !m.width || !t.width) return;

    // 只借 #intro 来放气泡，那台备用的角色永远不出现
    if (char) char.style.display = 'none';
    intro.hidden = false;
    document.body.classList.add('is-intro');

    // 气泡摆在插画正下方
    var bw = Math.min(320, window.innerWidth - 32);
    bubble.style.width = bw + 'px';
    bubble.style.left = Math.min(Math.max(16, a.left + (a.width - bw) / 2), window.innerWidth - bw - 16) + 'px';
    bubble.style.top = (a.bottom + 18) + 'px';
    bubble.style.opacity = '0';
    setTimeout(function () { bubble.style.opacity = '1'; }, 200);

    // 停两秒，然后让封面上这台电脑自己飞进右下角。
    // 全程只有它一只，不存在"藏一只、冒一只"。
    setTimeout(function () {
      bubble.style.opacity = '0';

      var scale = t.width / m.width;
      // translate 是相对元素自身算的，必须减掉插画自己的位置，否则会飞出屏幕
      var dx = (t.left - a.left) - scale * (m.left - a.left);
      var dy = (t.top - a.top) - scale * (m.top - a.top);
      art.style.transformOrigin = 'top left';
      art.style.transition = 'transform .95s cubic-bezier(.16, 1, .3, 1)';
      art.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + scale + ')';

      setTimeout(function () {
        // 落定：换成桌宠，再把插画放回去——这时才是"第二台电脑"出现
        art.style.transition = 'none';
        art.style.transform = '';
        art.style.opacity = '0';
        intro.hidden = true;
        document.body.classList.remove('is-intro');
        placePet();   // 此时布局已稳，重算一次，别让它停在左上角
        pet.classList.remove('is-hidden');
        resetIdle();

        setTimeout(function () {
          art.style.transition = 'opacity .35s ease-out';
          art.style.opacity = '';
        }, 80);
      }, 980);
    }, 2000);
  }

  if (pet) {
    placePet();
    resetIdle();
    scheduleRoam();
  }

  // ---------------------------------------------------------------
  // 开张
  // ---------------------------------------------------------------

  renderBits();
  renderCat();
  refresh();

  var start = (location.hash || '').replace('#', '');
  if (!start || !document.getElementById(start) || !canEnter(start)) start = 'cover';
  go(start, true);

  // 等封面入场动画落定再开口，否则量到的位置是斜的
  // 开场要播的话，先把角落那只藏起来，否则会先闪一下小的、再弹出大的
  var introOn = currentPageId() === 'cover'
    && !/[?&]nointro/.test(location.search)
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (introOn && pet) pet.classList.add('is-hidden');
  else if (pet) pet.classList.remove('is-hidden');
  // 不播开场就把禁用撤掉，否则按钮会一直点不动
  if (!introOn) document.body.classList.remove('is-intro');
  if (!introOn) { document.body.classList.remove('is-intro'); var ie = document.getElementById('intro'); if (ie) ie.hidden = true; }
  setTimeout(runIntro, 900);
})();
