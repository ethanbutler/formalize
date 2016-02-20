(function($){

  // App singleton instantiation
  // sets/gets app-wide state
  // these props are non-protected, but PLEASE use get/set for special handling
  var App = {
    currentPanel: 0,
    completed: 0,
    currentNumPanels: 1,
    isDope: 'no',
    get: function( prop ){
      return this[prop]
    },
    set: function( prop, value ){
      var current = value
      switch( prop ){ //special treatment for certain props
        case 'currentPanel': // prevents currentPanel from being negative or exceed panel count
          current = ( current > 0 ) ? current : 0
          current = ( current < App.get( 'currentNumPanels' )  ) ? current : App.get( 'currentNumPanels' )-1
          break
        case 'completed': // counts completed panels, updates progress section
          current = 0
          $( panels ).each( function(){
            if( this.isComplete ) current++
          } )
          $( '.progressCompleted span' ).text( current )
          break
        case 'currentNumPanels': // counts total present panels, updates progress section
          current = 0
          $( panels ).each( function(){
            if( this.isPresent ) current++
          } )
          $( '.progressTotal span' ).text( current )
          break
      }
      this[prop] = current
    },
    // syntactic sugar for advancing to next panel
    // verifies current panel is complete
    // sets artificial delay
    // TODO: skip over non-present panels with while loop
    forward: function(){
      if( panels[App.currentPanel].isComplete ){
        App.set( 'completed' )
        setTimeout( function(){
          App.set( 'currentPanel', App.get( 'currentPanel' ) + 1 )
          $( panels ).each( function(){
            this.setActive( App.get( 'currentPanel' ) )
          } )
        }, 500 )
      }
    },
    // syntactic sugar for moving to previous panel
    // no need to verify complete or set delay
    // TODO: skip over non-present panels with while loop
    backward: function(){ //move backward
      this.set( 'currentPanel', this.get( 'currentPanel' ) - 1 )
      $( panels ).each( function(){
        this.setActive( App.currentPanel )
      } )
    }
  }

  // Methods for validating form fields
  // properties:
  // test: anon function, should return true or false
  // message: error message for case of test: false
  // TODO: set up softfail so that something can not pass validation but still trigger forward
  var Validation = {
    didAnswerYes: {
      test: function( val ){
        return val === 'Yes'
      },
      message: 'You should have answered yes.'
    },
    isRequired: {
      test: function( val ){
        return val.length > 0
      },
      message: 'This field is required.'
    },
    isTextLengthLongerThanThree: {
      test: function( val ){
        return val.length >= 3
      },
      message: 'Input should be at least three characters.'
    },
    isNumeric: {
      test: function( val ){
        return $.isNumeric( val )
      },
      message: 'Should be a number'
    },
    isGoldenState: {
      test: function( val ){
        return val === 'Golden State'
      },
      message: 'Golden State is your favorite team.'
    }
  }

  // Callback methods
  // use these to update app-wide properties based on boolean
  var Callbacks = {
    updateIsDope: function( didPass ){
      App.set( 'isDope', didPass ? 'yes' : 'no' )
    }
  }

  //Panel Decorator
  var Panel = function( options ){
    this.$this = $( options.$this )
    this.$inputs = ( this.$this ).find( 'input, .btn--affirm' ) //array of all input fields TODO: make this work with select fields, too
    this.index = options.index
    this.hasError = false // optimistically, we're assuming our panels don't have errors before user input
    this.isActive = ( options.index === 0 ) //but only the first panel is active initially
    this.isComplete = false // the journey to move a mountain starts with a single step
    this.isDependent = options.state // set with data-state
    this.isPresent = true //all panels are present to start with

    //update component state and dom based on App.currentPanel
    this.setActive = function( current ){
      current = current || App.get( 'currentPanel' ) //set pageLoad state
      this.isActive = ( current == this.index )
      if( this.isActive ) this.$this.addClass( 'panel--active' )
      else                this.$this.removeClass( 'panel--active' )
    }

    //update component state and dom based on app state
    this.setIsPresent = function(){
      var state = this.$this.attr( 'data-state' )
      var value = this.$this.attr( 'data-value' )
      this.isPresent = !this.isDependent || App.get( state ) === value
      if( this.isPresent ) this.$this.removeClass( 'panel--isNotPresent' )
      else                 this.$this.addClass( 'panel--isNotPresent' )
    }

    //what to do when panel is completed
    this.onComplete = function(){
      this.isComplete = true
      this.$this.addClass( 'panel--isComplete' )
      console.log( 'Panel '+parseInt(this.index+1)+' passed!' ) //everyone needs validation sometimes. +1 to make it more readable
      App.forward()
    }

    //what to do when panel ISNT completed
    this.onError = function( err ){
      this.hasError = true
      console.log( err )
      this.$this.addClass( 'panel--hasError' )
      console.log( 'Panel '+parseInt(this.index+1)+' failed!' ) //but sometimes you need a kick in the butt
    }

    //provides event listeners to test for panel completion
    switch( options.advance ){
      case 'affirm':
        this.$inputs.on( 'click', function(){
          panels[App.currentPanel].onComplete()
        } )
        break
      case 'textMulti':
        var $inputs = this.$inputs
        var pass = false
        this.$inputs.on( 'blur', function(){
          var id = $(this).attr('id')
          if( inputs[id].mustValidate ) inputs[id].doValidate() //if input needs validation, do that
          $inputs.each( function(){
            pass = $(this).val().length > 0
            if( !pass ) return
          } )
          if( pass ) panels[App.currentPanel].onComplete()
        } )
        this.$inputs.on( 'keydown', function(e){ //or on enter
          if( e.which === 13 ){
            $(this).blur()
          }
        } )
        break
      case 'textSingle':
        var id = this.$inputs.attr('id')
        var handle = function(){
          if( inputs[id].mustValidate ) inputs[id].doValidate() //if input needs validation, do that
          else                          panels[App.currentPanel].onComplete() //if not, just do complete
        }
        this.$inputs.on( 'blur', function(){ //when focus changes, test for completion
          handle()
        } )
        this.$inputs.on( 'keydown', function(e){ //or on enter
          if( e.which === 13 ){
            $(this).blur()
          }
        } )
        break
      case 'radioMulti':
        var groups = this.$this.find( '.radioGroup' )
        var pass = false
        groups.on( 'click', function(){
          groups.each( function(){
            pass = $(this).find( 'input:checked' ).length > 0
            if( !pass ) return
          } )
          if( pass ) panels[App.currentPanel].onComplete()
        } )
        break
      case 'radioSingle': //this one's pretty simple
        this.$inputs.on( 'click', function(){
          panels[App.currentPanel].onComplete()
        } )
        break
    }

  }

  //Input Factory
  var Input = function( options ){
    this.$this = $( options.$this )
    this.id = options.id
    this.mustValidate = options.validate //whether inputs needs to be validated
    this.softfail = options.softfail //if we shouldn't throw error on non-validation
    if( options.validate ){ // only assign methods if needed
      this.doValidate = function(){
        var method = this.$this.attr( 'data-validate' ) //type of validation. should be property name of Validation
        var val = this.$this.val()
        var id = this.$this.attr('id')
        var results = Validation[method].test( val ) // get validation results
        this.$this.removeClass( 'input--isValid input--isNotValid' )
        this.$this.parent('.panel').removeClass( 'panel--isComplete panel--hasError') //clear dom from previous validation state
        if( results ){ // if we passed validation
          this.$this.addClass( 'input--isValid' )
          this.$this.siblings( '.validationOutput' ).empty() //clear validation message wrapper
          panels[App.currentPanel].onComplete()
        } else if( !this.softfail ) { // if we didnt'
          this.$this.addClass( 'input--isNotValid' )
          this.$this.siblings( '.validationOutput' ).text( Validation[method].message ) //add error message to dom
          panels[App.currentPanel].onError( Validation[method].message ) //pass error message to onError handler if needed
        }
        if( inputs[id].onValidate ) inputs[id].onValidate( results )
      }
      if( options.callback ){
        this.onValidate = function( didPass ){ //do callback based on whether we passed
          Callbacks[ options.callback ]( didPass )
          $( panels ).each( function(){
            this.setIsPresent() //update state of panels based on callback
          } )
        }
      }
    }
  }

  //init empty arrays/objects for our decorated things to live in
  var panels = []
  var inputs = {}

  //pull panels from dom and decorate them
  $('.panel').each( function( i ){
    var panel = new Panel( {
      index: i,
      $this: this,
      isDependent: $(this).attr( 'data-state' ), //should panel be hidden until certain state is hit? this should be partnered with data-value
      advance: $(this).attr( 'data-advance' ) // type of listener to set for moving forward
    } )
    //instantion methods
    panel.setActive()
    panel.setIsPresent()
    panels.push( panel )
    //set initial state of App
    App.set( 'currentNumPanels' )
  } )

  // pull inputs from dom and decorate them
  // these get pushed to object so they can be accessed by id
  // (it's more human readable i promise)
  $('input').each( function(){
    var input = new Input( {
      $this: this,
      id: $(this).attr('id'),
      callback: $(this).attr( 'data-callback' ), //use to update app state based on value
      validate: $(this).attr( 'data-validate' ), //special treatment for certain fields
      softfail: $(this).attr( 'data-softfail' )
    } )
    inputs[input.id] = input
  } )

  // these are here for debugging purposes right now
  document.onkeydown = function(e){
    if( e.which === 39 && panels[App.get('currentPanel')].isComplete )
    App.forward()
    if( e.which === 37 )
    App.backward()
  }

}(jQuery))
