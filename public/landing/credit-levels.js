(function () {
   var result = document.querySelector('[data-loan-result]');
   var buttons = document.querySelectorAll('[data-loan-choice]');
   var timer;

   if (!result || buttons.length === 0) return;

   var modes = {
      trust: {
         kicker: 'Trust-Building Loan',
         title: 'A smaller loan builds your record.',
         body: 'Repay the agreed total on time. Your repayment history grows, while your current limit stays at $15.',
         history: 'Stronger',
         limit: 'Still $15',
         type: 'Trust-Building',
         amount: '$10',
         repay: 'Agreed before funding'
      },
      credit: {
         kicker: 'Credit-Building Loan',
         title: 'A full-limit loan can unlock $20.',
         body: 'Borrow your full $15 limit and repay the accepted terms on time. Your history grows and your next Credit Level can unlock.',
         history: 'Stronger',
         limit: '$20 unlocked',
         type: 'Credit-Building',
         amount: '$15',
         repay: 'Example: $18 total'
      }
   };

   function setText(selector, value) {
      var target = result.querySelector(selector);
      if (target) target.textContent = value;
   }

   function updateLoan(modeName) {
      var mode = modes[modeName];
      if (!mode) return;

      buttons.forEach(function (button) {
         button.setAttribute('aria-pressed', button.dataset.loanChoice === modeName ? 'true' : 'false');
      });

      setText('[data-loan-kicker]', mode.kicker);
      setText('[data-loan-title]', mode.title);
      setText('[data-loan-body]', mode.body);
      setText('[data-history-outcome]', mode.history);
      setText('[data-limit-outcome]', mode.limit);
      setText('[data-product-type]', mode.type);
      setText('[data-product-amount]', mode.amount);
      setText('[data-product-repay]', mode.repay);

      result.classList.remove('is-updating');
      window.requestAnimationFrame(function () {
         result.classList.add('is-updating');
         window.clearTimeout(timer);
         timer = window.setTimeout(function () {
            result.classList.remove('is-updating');
         }, 360);
      });
   }

   buttons.forEach(function (button) {
      button.addEventListener('click', function () {
         updateLoan(button.dataset.loanChoice);
      });
   });
})();
