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
         '/credit-levels': '/landing/credit-levels.html',
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

   var siteHeader = document.querySelector('.site-header');

   if (siteHeader) {
      var headerFrame;

      var syncHeader = function () {
         headerFrame = undefined;
         siteHeader.classList.toggle('is-scrolled', window.scrollY > 24);
      };

      window.addEventListener(
         'scroll',
         function () {
            if (headerFrame) return;
            headerFrame = window.requestAnimationFrame(syncHeader);
         },
         { passive: true }
      );
      syncHeader();
   }

   var loadingButtons = Array.from(document.querySelectorAll('a.button[href]')).filter(function (link) {
      var href = link.getAttribute('href') || '';
      return link.target !== '_blank' && href.indexOf('mailto:') !== 0 && href.indexOf('tel:') !== 0 && href.charAt(0) !== '#';
   });

   loadingButtons.forEach(function (link) {
      link.addEventListener('click', function () {
         link.classList.add('is-loading');
      });
   });

   window.addEventListener('pageshow', function () {
      loadingButtons.forEach(function (link) {
         link.classList.remove('is-loading');
      });
   });

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

      // scrubbed route spotlight (George 07-18): the cash-out panel's phone
      // shot is the real selector screenshot — as the scroll moves through
      // the beat, a butter-yellow ring walks down its provider rows so every
      // route gets a moment even with zero autonomous motion (scroll-driven,
      // so it works under prefers-reduced-motion too). Ring is yellow on
      // purpose: the screenshot already paints Coins.ph's SELECTED state
      // purple, and the spotlight must read as "look here", not "selected".
      // Row boxes are [top, height] in the source screenshot's 390px-wide
      // pixel space (Coins.ph / GCrypto / PDAX; Binance sits under the
      // caption pill's crop, so the walk stops at PDAX); the shot renders
      // object-fit:cover top-aligned, so display position = src * width scale.
      // Coords re-measured off the source pixels 07-21 so the ring hugs each
      // card: the cards sit at x 22..376 (left/width below), and the three
      // card boxes are Coins.ph 301..401, GCrypto 413..497, PDAX 509..~595.
      var routesShot = story.querySelector('.deal-product-shot-routes');
      var routeFocus = null;
      var routeRows = [
         [298, 106],
         [412, 86],
         [508, 87],
      ];
      if (routesShot) {
         routeFocus = document.createElement('span');
         routeFocus.setAttribute('aria-hidden', 'true');
         routeFocus.style.cssText =
            'position:absolute;left:5.5%;width:91%;border-radius:16px;' +
            'border:2.5px solid var(--butter-strong);' +
            'box-shadow:0 0 0 5px oklch(86% 0.145 83 / 0.22);' +
            'opacity:0;pointer-events:none;' +
            (reduceMotion ? '' : 'transition:top 0.28s cubic-bezier(0.22, 0.61, 0.36, 1);');
         routesShot.appendChild(routeFocus);
      }

      function positionRouteFocus(position) {
         if (!routeFocus) return;
         var panelIndex = dealPanels.indexOf(routesShot.closest('[data-deal-panel]'));
         if (panelIndex < 0) return;
         // walk the three rows across the beat's full-ink plateau
         var local = Math.min(1, Math.max(0, (position - (panelIndex - 0.4)) / 0.8));
         var row = routeRows[Math.min(routeRows.length - 1, Math.floor(local * routeRows.length))];
         var scale = routesShot.clientWidth / 390;
         routeFocus.style.top = (row[0] * scale).toFixed(1) + 'px';
         routeFocus.style.height = (row[1] * scale).toFixed(1) + 'px';
         routeFocus.style.opacity = '1';
      }

      function clearDealScrub() {
         story.classList.remove('is-scrubbed');
         if (routeFocus) routeFocus.style.opacity = '0';
         dealSteps.forEach(function (step) {
            step.style.opacity = '';
            step.style.transform = '';
         });
         dealPanels.forEach(function (panel) {
            panel.style.opacity = '';
            panel.style.transform = '';
            panel.style.visibility = '';
            panel.style.zIndex = '';
         });
      }

      function syncDealToViewport() {
         dealFrame = undefined;
         if (!isAnimatedDeal()) return;

         var viewportTarget = window.innerHeight * (isMobileDeal() ? 0.58 : 0.52);
         var closestIndex = 0;
         var closestDistance = Infinity;
         var scrubbing = isDesktopDeal();
         var scrubRange = window.innerHeight * 0.4;
         var stepCenters = [];

         story.classList.toggle('is-scrubbed', scrubbing);

         dealSteps.forEach(function (step, index) {
            var rect = step.getBoundingClientRect();
            var stepCenter = rect.top + rect.height / 2;
            var distance = Math.abs(stepCenter - viewportTarget);
            stepCenters.push(stepCenter);
            if (distance < closestDistance) {
               closestDistance = distance;
               closestIndex = index;
            }

            if (scrubbing) {
               // roulette scrub: fade/offset track the scroll continuously —
               // full ink on the focus line, easing to the resting 0.3 / 16px
               // one scrub-range away (matches the non-scrubbed CSS values)
               var t = Math.min(1, distance / scrubRange);
               step.style.opacity = (1 - t * 0.7).toFixed(3);
               step.style.transform = 'translateX(' + (t * 16).toFixed(1) + 'px)';
            }
         });

         if (scrubbing) {
            // stage panels scrub too: instead of the class flip (which pops the
            // new panel in the moment a step crosses the focus line), express
            // the scroll as a fractional step position and crossfade the two
            // bracketing panels continuously. Each panel holds fully opaque
            // near its own step (d < 0.28) and hands off across the middle
            // stretch, so the swap happens WITH the scroll, never against it.
            var position = 0;
            var lastCenter = stepCenters.length - 1;
            if (lastCenter > 0) {
               if (viewportTarget <= stepCenters[0]) {
                  position = 0;
               } else if (viewportTarget >= stepCenters[lastCenter]) {
                  position = lastCenter;
               } else {
                  for (var pair = 0; pair < lastCenter; pair += 1) {
                     if (viewportTarget < stepCenters[pair + 1]) {
                        position = pair + (viewportTarget - stepCenters[pair]) / (stepCenters[pair + 1] - stepCenters[pair]);
                        break;
                     }
                  }
               }
            }

            dealPanels.forEach(function (panel, panelIndex) {
               // fade-through, not crossfade: each panel is fully gone just past
               // the halfway line (d = 0.52), so two panels' text never sit
               // double-exposed on top of each other mid-swap. Hold at full ink
               // until d = 0.34 (was 0.26 — George 07-18: the panel was a ghost
               // for most of its step's scroll window, "so quick, hard to read");
               // the whole fade now lives in the last stretch before the handoff
               var d = Math.abs(position - panelIndex);
               var t = Math.min(1, Math.max(0, (d - 0.34) / 0.18));
               var eased = t * t * (3 - 2 * t);
               var dir = panelIndex > position ? 1 : -1;
               panel.style.opacity = (1 - eased).toFixed(3);
               panel.style.transform = 'translateY(' + (dir * eased * 22).toFixed(1) + 'px)';
               panel.style.visibility = eased >= 1 ? 'hidden' : 'visible';
               panel.style.zIndex = eased >= 1 ? '' : String(10 - Math.round(eased * 5));
            });

            positionRouteFocus(position);
         }

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
         if (!isDesktopDeal()) clearDealScrub();

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

(function () {
   var carousel = document.querySelector('.dignity-grid');
   var slides = carousel ? Array.prototype.slice.call(carousel.querySelectorAll('.dignity-promise')) : [];
   var previousButton = document.querySelector('[data-dignity-previous]');
   var nextButton = document.querySelector('[data-dignity-next]');
   var currentLabel = document.querySelector('[data-dignity-current]');
   var mobileCarousel = window.matchMedia('(max-width: 699px)');
   var activeIndex = 0;
   var scrollFrame;

   if (!carousel || !slides.length || !previousButton || !nextButton || !currentLabel) return;

   function updateStatus(index) {
      activeIndex = Math.max(0, Math.min(slides.length - 1, index));
      currentLabel.textContent = String(activeIndex + 1);
   }

   function closestSlideIndex() {
      var carouselLeft = carousel.getBoundingClientRect().left;
      var closestIndex = 0;
      var closestDistance = Infinity;

      slides.forEach(function (slide, index) {
         var distance = Math.abs(slide.getBoundingClientRect().left - carouselLeft);
         if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = index;
         }
      });

      return closestIndex;
   }

   function syncStatus() {
      scrollFrame = undefined;
      if (!mobileCarousel.matches) return;
      updateStatus(closestSlideIndex());
   }

   function requestStatusSync() {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(syncStatus);
   }

   function showSlide(index) {
      var nextIndex = (index + slides.length) % slides.length;
      updateStatus(nextIndex);
      carousel.scrollTo({ left: slides[nextIndex].offsetLeft - slides[0].offsetLeft, behavior: 'smooth' });
   }

   previousButton.addEventListener('click', function () {
      showSlide(activeIndex - 1);
   });

   nextButton.addEventListener('click', function () {
      showSlide(activeIndex + 1);
   });

   carousel.addEventListener('scroll', requestStatusSync, { passive: true });

   function resetCarousel(event) {
      if (!event.matches) {
         carousel.scrollLeft = 0;
         updateStatus(0);
      }
   }

   if (typeof mobileCarousel.addEventListener === 'function') {
      mobileCarousel.addEventListener('change', resetCarousel);
   } else if (typeof mobileCarousel.addListener === 'function') {
      mobileCarousel.addListener(resetCarousel);
   }
})();
