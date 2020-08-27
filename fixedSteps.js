import $ from "jquery";
import { addSwipeDownEvent, addSwipeUpEvent } from "./swipe.js";
import "pure-swipe";

function documentScrollY(){
    return document.documentElement.scrollTop;
}

function setDocumentScrollY(n){
    return document.documentElement.scrollTop = n;
}

export class FixedSteps{
    constructor(args = {}){
        const {
            stepsSelector = '.step',
            special = null,
            nextTriggerSelector = '',
            prevTriggerSelector = '',
        } = args;
        this.stepsSelector = stepsSelector;
        this.special = special;
        this.$currentStep = null;
        this.changingStep = false;
        this.prevTriggerSelector = prevTriggerSelector;
        this.nextTriggerSelector = nextTriggerSelector;
        this.animationLoop = this.animationLoop.bind(this);
        this.setEventsState();
        this.attachEvents();
    }

    /**
    *   The trigger of a fixedSteps related event is recorded in this.eventsTracker, in order
    *   to have access to this records in the requestAnimationFrame, and take action
    *   accordingly
    *   This method sets the event trackers to their initial state
    */
    setEventsState(){
        this.eventsTracker = {
            downKey: false,
            upKey: false,
            wheelDown: false,
            wheelUp: false,
            swipeDown: false,
            swipeUp: false,
            nextTriggerClicked: false,
            prevTriggerClicked: false,
            goTo: false, //string stepID
            resize: false,
        };
    }

    /**
    *   Returns special arguments for the section
    *   @param {string} sectionID
    */
    getSectionSpecial(sectionID){
        return this.special ? this.special[sectionID] : null;
    }

    getStepID($step){
        return $step.attr('id');
    }

    getStepElem(stepID){
        return $(`${this.stepsSelector}#${stepID}`)
    }

    getStepElemByIndex(i){
        return $(this.stepsSelector).eq(i);
    }

    getStepIndex($step){
        return $step.index(this.stepsSelector);
    }

    getCurrentIndex(){
        return this.getStepIndex( this.$currentStep );
    }

    // Step elem offset top
    stepOffsetTop($step){
        return $step.offset().top;
    }

    // offset top from the step elem bottom
    stepBottomOffsetTop($step){
        return this.stepOffsetTop($step) + $step.height()
    }

    // offset top where the step bottom meets the window bottom
    stepBottomOffsetTopComplete($step){
        return this.stepBottomOffsetTop($step) - window.innerHeight
    }

    /**
    *   Returns how many steps are between one an another.
    *   @param {jQuery} $step
    *   @param {jQuery} $against - defaults to current step
    *   @return {int} < 0 if $step is after, > 0 if $step if before, 0 if there is no
    *   distance between $step and $against
    */
    stepsBetween($step, {$against = this.$currentStep} = {}){
        // $against = $against ? $against : this.$currentStep;
        return this.getStepIndex($step) - this.getStepIndex($against);
    }

    /**
    *   Goes to a section by index
    *   @param {jQuery} $step
    */
    goToStep($step, {
        animate = true,
        force = false,
        toStepBottom = false,
    } = {}){

        if(!$step.length || this.changingStep)
            return false;

        const stepsBetween = this.stepsBetween($step);
        const stepToIndex = this.getStepIndex($step);
        const currentIndex = this.getStepIndex(this.$currentStep);
        const isBefore = stepsBetween < 0;
        const isAdjacent = stepsBetween == 1 || stepsBetween == -1;

        var lastShouldContinue = true; // tiene el valor del ultimo goPrev/goNext que se corrio. Si las secciones son adyacentes, indica si se hace scroll o no
        for(let i = currentIndex; isBefore ? i >= stepToIndex : i <= stepToIndex; isBefore ? i-- : i++){
            const $betweenSection = $(this.stepsSelector).eq(i);
            // console.log($betweenSection.attr('id'), lastShouldContinue);
            const special = this.getSectionSpecial($betweenSection.attr('id'));
            const methodName = isBefore ? "goPrev" : "goNext";

            if( (!isAdjacent || i == currentIndex) && (special && special[methodName]) ){
                if( (stepToIndex != i) || isBefore )
                    lastShouldContinue = special[methodName]({ force });
            }
        }

        // if( Math.abs(stepsBetween) > 1 || force )
        if(lastShouldContinue){
            const _this = this;
            const currentSpecial = this.getSectionSpecial( this.getStepID(this.$currentStep) );
            const toGoSpecial = this.getSectionSpecial( this.getStepID($step) );
            this.changingStep = true;

            if( currentSpecial && currentSpecial.onExit ){
                currentSpecial.onExit();
            }

            const goToStepBottom = toStepBottom || (isBefore && toGoSpecial && toGoSpecial.enterFrontEnd);
            const newScrollTop = goToStepBottom ? this.stepBottomOffsetTopComplete($step) : this.stepOffsetTop($step);
            const $body = $('html, body');
            const animatePromise = $body.animate({
                scrollTop: newScrollTop,
            }, 500);
            if(!animate)
                $body.finish();
            animatePromise.promise().done(function(){
                setDocumentScrollY(newScrollTop)
                _this.$currentStep = $step;
                _this.changingStep = false;

                if( toGoSpecial && toGoSpecial.onEnter ){
                    toGoSpecial.onEnter();
                }
            });
        }
    }

    goNextStep(args){
        const nextIndex = this.$currentStep.index(this.stepsSelector) + 1;
        const $next = $(this.stepsSelector).eq(nextIndex);
        this.goToStep($next, args);
    }

    goPrevStep(args){
        const prevIndex = Math.max(0, this.$currentStep.index(this.stepsSelector) - 1);
        const $prev = $(this.stepsSelector).eq( prevIndex );
        this.goToStep($prev, args);
    }

    animationLoop(){
        const { downKey, upKey, wheelDown, wheelUp, swipeDown, swipeUp, nextTriggerClicked, prevTriggerClicked, goTo, resize } = this.eventsTracker;

        if(this.$currentStep){
            if( resize ){
                if( documentScrollY() < this.stepOffsetTop(this.$currentStep) ) //arriba
                    this.goToStep(this.$currentStep, {animate: false})
                else if( documentScrollY() > this.stepBottomOffsetTopComplete(this.$currentStep) )//abajo
                    this.goToStep(this.$currentStep, {animate: false, toStepBottom: true})
            }
            else if( goTo )
                this.goToStep(this.getStepElem(goTo), {
                    force: $(this).data('force'),
                })
            else if( downKey || wheelDown || swipeUp || prevTriggerClicked)
                this.goNextStep()
            else if( upKey || wheelUp || swipeDown || nextTriggerClicked)
                this.goPrevStep()
            else if( !this.changingStep ){
                if( documentScrollY() > this.stepBottomOffsetTopComplete(this.$currentStep) )
                    this.goNextStep()
                else if( documentScrollY() + 1 < this.stepOffsetTop(this.$currentStep) ) //for some reason, on some steps at the beggining, documentScrollY < step.offsetTop. The + 1 tries to fix that
                    this.goPrevStep()
            }

            // if(documentScrollY() == this.oldScrollY){
                this.setEventsState();
            // }

            this.oldScrollY = documentScrollY();
        }

        requestAnimationFrame(this.animationLoop)
    }

    attachEvents(){
        const _this = this;

        document.addEventListener("wheel", function () {
            if (Math.sign(event.deltaY) === 1)
                _this.eventsTracker.wheelDown = true
            else
                _this.eventsTracker.wheelUp = true
        });

        $(document).ready(function(){
            _this.$currentStep = $(_this.stepsSelector).first();

            if(document.querySelector('html').scrollTop > 0){
                _this.changingStep = true;
                $('html, body').animate({
                    scrollTop: _this.$currentStep.offset().top,
                }, 400, function(){
                    _this.changingStep = false;
                });
            }

            document.addEventListener('keydown', (event) => {
                if(event.keyCode == 32 || event.keyCode == 40)
                    _this.eventsTracker.downKey = true
                else if(event.keyCode == 38)
                    _this.eventsTracker.upKey = true
            });

            $(document).on('click', "[data-goto]", function(){
                _this.eventsTracker.goTo = $(this).data('goto');
            })

            if(_this.nextTriggerSelector){
                $(document).on('click', _this.nextTriggerSelector, function(){
                    _this.eventsTracker.nextTriggerClicked = true;
                })
            }

            if(_this.prevTriggerSelector){
                $(document).on('click', _this.prevTriggerSelector, function(){
                    _this.eventsTracker.prevTriggerClicked = true;
                })
            }

            window.addEventListener('resize', function(){
                _this.eventsTracker.resize = true;
            });
        })

        document.addEventListener('swiped-up', function(e) {
            _this.eventsTracker.swipeUp = true;
        });

        document.addEventListener('swiped-down', function(e) {
            _this.eventsTracker.swipeDown = true;
        });

        requestAnimationFrame(this.animationLoop);
    }

    detachEvents(){
        cancelAnimationFrame(this.animationLoop);
    }
}
