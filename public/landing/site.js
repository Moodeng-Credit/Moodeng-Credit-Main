(function () {
   var versionSwitcher = document.querySelector('[data-version-switcher]');
   var localHosts = ['localhost', '127.0.0.1', '::1'];
   var isLocalPreview = localHosts.indexOf(window.location.hostname) !== -1;
   var requestedVersion = new URLSearchParams(window.location.search).get('version');
   var explicitVersion = requestedVersion === '1' || requestedVersion === '2' ? requestedVersion : null;
   var desktopLanding = window.matchMedia('(min-width: 1024px)');

   function applyLandingVersion() {
      var landingVersion = explicitVersion || (desktopLanding.matches ? '2' : '1');
      document.documentElement.dataset.landingVersion = landingVersion;

      if (!versionSwitcher || !isLocalPreview) return;
      versionSwitcher.querySelectorAll('[data-version-link]').forEach(function (link) {
         if (link.dataset.versionLink === landingVersion) {
            link.setAttribute('aria-current', 'page');
         } else {
            link.removeAttribute('aria-current');
         }
      });
   }

   applyLandingVersion();

   if (!explicitVersion) {
      if (typeof desktopLanding.addEventListener === 'function') {
         desktopLanding.addEventListener('change', applyLandingVersion);
      } else if (typeof desktopLanding.addListener === 'function') {
         desktopLanding.addListener(applyLandingVersion);
      }
      window.addEventListener('resize', applyLandingVersion, { passive: true });
   }

   if (isLocalPreview) {
      var localPreviewRoutes = {
         '/': '/landing/',
         '/how-it-works': '/landing/how-it-works.html',
         '/how-to-cash-out': '/landing/how-to-cash-out.html',
         '/how-to-repay': '/landing/how-to-repay.html',
         '/for-lenders': '/landing/for-lenders.html',
         '/about': '/landing/about.html',
         '/sign-in': 'https://moodeng.app/sign-in',
         '/request-board': 'https://moodeng.app/request-board'
      };

      document.querySelectorAll('a[href]').forEach(function (link) {
         var href = link.getAttribute('href');
         if (href && localPreviewRoutes[href]) {
            link.setAttribute('href', localPreviewRoutes[href]);
         }
      });
   }

   if (versionSwitcher && isLocalPreview) {
      versionSwitcher.hidden = false;
   }

   var dialog = document.querySelector('[data-menu-dialog]');
   var openButton = document.querySelector('[data-menu-open]');
   var closeButton = document.querySelector('[data-menu-close]');

   function openMenu() {
      if (!dialog || typeof dialog.showModal !== 'function') return;
      dialog.showModal();
      document.body.classList.add('menu-open');
      openButton && openButton.setAttribute('aria-expanded', 'true');
      closeButton && closeButton.focus();
   }

   function closeMenu() {
      if (!dialog || !dialog.open) return;
      dialog.close();
   }

   if (openButton && dialog) {
      openButton.addEventListener('click', openMenu);
   }

   if (closeButton && dialog) {
      closeButton.addEventListener('click', closeMenu);
   }

   if (dialog) {
      dialog.addEventListener('close', function () {
         document.body.classList.remove('menu-open');
         openButton && openButton.setAttribute('aria-expanded', 'false');
         openButton && openButton.focus();
      });

      dialog.addEventListener('click', function (event) {
         if (event.target === dialog) closeMenu();
      });
   }

   var askGroups = document.querySelectorAll('[data-ask-group]');
   var askPreviewReason = document.querySelector('[data-ask-preview-reason]');
   var askPreviewIcon = document.querySelector('[data-ask-preview-icon]');
   var askPreviewPayback = document.querySelector('[data-ask-preview-payback]');
   var askPreviewDue = document.querySelector('[data-ask-preview-due]');
   var askPreview = document.querySelector('.ask-preview');
   var askPreviewTimer;

   function animateAskPreview() {
      if (!askPreview) return;
      askPreview.classList.remove('is-updating');
      window.requestAnimationFrame(function () {
         askPreview.classList.add('is-updating');
         window.clearTimeout(askPreviewTimer);
         askPreviewTimer = window.setTimeout(function () {
            askPreview.classList.remove('is-updating');
         }, 360);
      });
   }

   askGroups.forEach(function (group) {
      group.addEventListener('click', function (event) {
         var button = event.target.closest('.ask-chip');
         if (!button || !group.contains(button)) return;

         group.querySelectorAll('.ask-chip').forEach(function (choice) {
            choice.setAttribute('aria-pressed', choice === button ? 'true' : 'false');
         });

         if (button.dataset.askReason) {
            if (askPreviewReason) askPreviewReason.textContent = button.dataset.askReason;
            if (askPreviewIcon && button.dataset.askIcon) askPreviewIcon.setAttribute('href', button.dataset.askIcon);
         }

         if (button.dataset.askPayback && askPreviewPayback) {
            askPreviewPayback.textContent = '$' + button.dataset.askPayback;
         }

         if (button.dataset.askDue && askPreviewDue) {
            askPreviewDue.textContent = button.dataset.askDue;
         }

         animateAskPreview();
      });
   });

   var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   var revealItems = document.querySelectorAll('.reveal');

   if (reduceMotion || !('IntersectionObserver' in window)) {
      revealItems.forEach(function (item) {
         item.classList.add('is-visible');
      });
   } else {
      var observer = new IntersectionObserver(
         function (entries) {
            entries.forEach(function (entry) {
               if (!entry.isIntersecting) return;
               entry.target.classList.add('is-visible');
               observer.unobserve(entry.target);
            });
         },
         { rootMargin: '0px 0px -8%', threshold: 0.08 }
      );

      revealItems.forEach(function (item) {
         observer.observe(item);
      });
   }

   var dealStories = document.querySelectorAll('[data-deal-story]');

   dealStories.forEach(function (story) {
      var dealSteps = Array.from(story.querySelectorAll('[data-deal-step]'));
      var dealPanels = Array.from(story.querySelectorAll('[data-deal-panel]'));
      var dealDots = Array.from(story.querySelectorAll('[data-deal-dot]'));
      var dealCount = story.querySelector('[data-deal-count]');
      var dealTitle = story.querySelector('[data-deal-title]');
      var desktopDeal = window.matchMedia('(min-width: 1024px)');
      var activeDealIndex = -1;
      var dealFrame;

      function isDesktopDeal() {
         return desktopDeal.matches && document.documentElement.dataset.landingVersion === '2';
      }

      function isMobileDeal() {
         return !desktopDeal.matches;
      }

      function isAnimatedDeal() {
         return isDesktopDeal() || isMobileDeal();
      }

      function activateDealStep(index) {
         if (index === activeDealIndex) return;
         activeDealIndex = index;
         story.dataset.dealActive = String(index);

         dealSteps.forEach(function (step, stepIndex) {
            var active = stepIndex === index;
            step.classList.toggle('is-active', active);
            if (active && isAnimatedDeal()) {
               step.setAttribute('aria-current', 'step');
            } else {
               step.removeAttribute('aria-current');
            }
         });

         dealPanels.forEach(function (panel, panelIndex) {
            panel.classList.toggle('is-active', panelIndex === index);
            panel.classList.remove('is-prev');
            panel.setAttribute('aria-hidden', panelIndex === index ? 'false' : 'true');
         });

         dealDots.forEach(function (dot, dotIndex) {
            dot.classList.toggle('is-active', dotIndex === index);
            dot.classList.toggle('is-complete', dotIndex < index);
         });

         if (dealCount) {
            dealCount.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(dealSteps.length).padStart(2, '0');
         }

         if (dealTitle) {
            var activeTitle = dealSteps[index] && dealSteps[index].querySelector('b');
            dealTitle.textContent = activeTitle ? activeTitle.textContent : '';
         }
      }

      function syncDealToViewport() {
         dealFrame = undefined;
         if (!isAnimatedDeal()) return;

         var viewportTarget = window.innerHeight * (isMobileDeal() ? 0.58 : 0.52);
         var closestIndex = 0;
         var closestDistance = Infinity;

         dealSteps.forEach(function (step, index) {
            var rect = step.getBoundingClientRect();
            var stepCenter = rect.top + rect.height / 2;
            var distance = Math.abs(stepCenter - viewportTarget);
            if (distance < closestDistance) {
               closestDistance = distance;
               closestIndex = index;
            }
         });

         activateDealStep(closestIndex);
      }

      function requestDealSync() {
         if (dealFrame) return;
         dealFrame = window.requestAnimationFrame(syncDealToViewport);
      }

      function configureDealStory() {
         window.removeEventListener('scroll', requestDealSync);
         window.removeEventListener('resize', requestDealSync);
         if (dealFrame) window.cancelAnimationFrame(dealFrame);
         dealFrame = undefined;
         activeDealIndex = -1;
         story.classList.toggle('is-mobile-animated', isMobileDeal());

         if (!isAnimatedDeal()) {
            dealSteps.forEach(function (step) {
               step.removeAttribute('aria-current');
            });
            activateDealStep(0);
            return;
         }

         window.addEventListener('scroll', requestDealSync, { passive: true });
         window.addEventListener('resize', requestDealSync);
         requestDealSync();
      }

      configureDealStory();

      if (typeof desktopDeal.addEventListener === 'function') {
         desktopDeal.addEventListener('change', configureDealStory);
      } else if (typeof desktopDeal.addListener === 'function') {
         desktopDeal.addListener(configureDealStory);
      }
   });

   var productStories = document.querySelectorAll('[data-product-story]');

   productStories.forEach(function (story) {
      var storySteps = Array.from(story.querySelectorAll('[data-story-step]'));
      var storyScreens = Array.from(story.querySelectorAll('[data-story-screen]'));
      var storyDots = Array.from(story.querySelectorAll('[data-story-dot]'));
      var storyCount = story.querySelector('[data-story-count]');
      var storyTitle = story.querySelector('[data-story-title]');
      var desktopStory = window.matchMedia('(min-width: 1024px)');
      var activeStoryIndex = -1;
      var storyFrame;

      function activateStoryStep(index) {
         if (index === activeStoryIndex) return;
         activeStoryIndex = index;
         story.dataset.storyActive = String(index);

         storySteps.forEach(function (step, stepIndex) {
            var active = stepIndex === index;
            step.classList.toggle('is-active', active);
            if (active && desktopStory.matches) {
               step.setAttribute('aria-current', 'step');
            } else {
               step.removeAttribute('aria-current');
            }
         });

         storyScreens.forEach(function (screen, screenIndex) {
            screen.classList.toggle('is-active', screenIndex === index);
         });

         storyDots.forEach(function (dot, dotIndex) {
            dot.classList.toggle('is-active', dotIndex === index);
            dot.classList.toggle('is-complete', dotIndex < index);
         });

         if (storyCount) {
            storyCount.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(storySteps.length).padStart(2, '0');
         }

         if (storyTitle) {
            var activeTitle = storySteps[index] && storySteps[index].querySelector('h3');
            storyTitle.textContent = activeTitle ? activeTitle.textContent : '';
         }
      }

      function syncStoryToViewport() {
         storyFrame = undefined;
         if (!desktopStory.matches) return;

         var viewportTarget = window.innerHeight * 0.52;
         var closestIndex = 0;
         var closestDistance = Infinity;

         storySteps.forEach(function (step, index) {
            var rect = step.getBoundingClientRect();
            var stepCenter = rect.top + rect.height / 2;
            var distance = Math.abs(stepCenter - viewportTarget);
            if (distance < closestDistance) {
               closestDistance = distance;
               closestIndex = index;
            }
         });

         activateStoryStep(closestIndex);
      }

      function requestStorySync() {
         if (storyFrame) return;
         storyFrame = window.requestAnimationFrame(syncStoryToViewport);
      }

      function configureStory() {
         window.removeEventListener('scroll', requestStorySync);
         window.removeEventListener('resize', requestStorySync);
         if (storyFrame) window.cancelAnimationFrame(storyFrame);
         storyFrame = undefined;
         activeStoryIndex = -1;

         if (!desktopStory.matches) {
            storySteps.forEach(function (step) {
               step.removeAttribute('aria-current');
            });
            return;
         }

         window.addEventListener('scroll', requestStorySync, { passive: true });
         window.addEventListener('resize', requestStorySync);
         requestStorySync();
      }

      configureStory();

      if (typeof desktopStory.addEventListener === 'function') {
         desktopStory.addEventListener('change', configureStory);
      } else if (typeof desktopStory.addListener === 'function') {
         desktopStory.addListener(configureStory);
      }
   });
})();
