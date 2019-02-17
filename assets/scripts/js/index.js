/*
 * Original Game By
 * David Lettier (C) 2014.
 * 
 * http://www.lettier.com/
 * 
 * 3D Bowling Game
 * 
 * Dependencies:
 * 
 *      Three.js
 *      Cannon.js
 *      Buzz.js
 * 
 */

// Game globals.

var current_round_throws = 0;

var play   = true;

// Audio globals.

var audio_on = true;

var background_track, roll_sound_effect, hit_sound_effect;

var hit_sound_effect_played = ( new Date( ) ).valueOf( );

// 2D globals.

var loading_div, throwing_div;

var mouse_positions = [ ];

var on_mouse_down_position = [ ];

var on_mouse_down_time = 0;

var on_mouse_down_mouse_on_ball = false;

var mouse_is_down = false;

// 3D globals.

var canvas;

var camera, scene, renderer, projector;

var throwing_view = { 
  position: { x: 0, y: 290, z: 55 },
  look_at:  { x: 0, y:   0, z: 0  }
};

var bowling_pin_view = { 
  position: { x: 0, y: -195, z: 55 },
  look_at:  { x: 0, y: -195, z:  0 }
};

var spot_light

var bowling_ball;

var bowling_pins = [ ];
var bowling_pin_positions = [
  [ -21, -210, 10.8 ],
  [  -7, -210, 10.8 ],
  [   7, -210, 10.8 ],
  [  21, -210, 10.8 ],  
  [ -14, -200, 10.8 ],
  [   0, -200, 10.8 ],
  [  14, -200, 10.8 ],
  [  -7, -190, 10.8 ],
  [   7, -190, 10.8 ],
  [   0, -180, 10.8 ]
];
var hit_bowling_pins = [ ];
var bowling_pins_reset = true;
var resetting_bowling_pins = false;

var bowling_ball_origin = [ 0, 200, 10 ];
var bowling_ball_damping = 0.1;

var bowling_ball_loaded = false;
var bowling_ball_last_updated_position = bowling_ball_origin;

var bowling_ball_thrown = false;

var throwing_direction_arrow;

var throwing_target;

var floor_loaded = false;

var world;

var timers = [ ];

var current_view   = "throw";
var switching_view = false;

var textures_loaded = 0;

var number_of_textures = 0;

function initialize() {
  initialize_2d();
  initialize_3d();
  initialize_audio();
  initialize_opening_sequence();
}

function initialize_audio() {
  window.setTimeout( function () {
    roll_sound_effect = new buzz.sound( "assets/audio/ball_rolling", { formats: [ "ogg", "mp3" ] } );
    roll_sound_effect.setVolume( 100 );
    roll_sound_effect.load();

    // pins_hit.ogg shortened from
    // https://freesound.org/people/Tomlija/sounds/99563/
    // https://creativecommons.org/licenses/by/3.0/
    
    hit_sound_effect = new buzz.sound( "assets/audio/pins_hit", { formats: [ "ogg", "mp3" ] } );
    hit_sound_effect.setVolume( 100 );
    hit_sound_effect.load();
    
    background_track = new buzz.sound( "assets/audio/ambient_background", { formats: [ "ogg" ] } );
    background_track.setVolume( 100 );
    background_track.load().loop().play();
  }, 6500 );
}

function toggle_audio() {
  if ( audio_on == true ) {
    background_track.mute();
    roll_sound_effect.mute();
    hit_sound_effect.mute();
    
    audio_on = false;
  }      
  else if ( audio_on == false ) {
    background_track.unmute();
    roll_sound_effect.unmute();
    hit_sound_effect.unmute();
    
    audio_on = true;
  }
}

function initialize_2d() {
  
  loading_div              = document.createElement( "div" );
  loading_div.id           = "loading_div";
  loading_div.className    = "loading_div";
  loading_div.innerHTML    = "LOADING";
  document.body.appendChild( loading_div );
  
  loading_div.style.top        = ( ( window.innerHeight / 2 ) - ( loading_div.clientHeight / 2 ) ) + "px";
  loading_div.style.left       = ( ( window.innerWidth  / 2 ) - ( loading_div.clientWidth  / 2 ) ) + "px";
  loading_div.style.visibility = "visible";  
  
  throwing_div               = document.createElement( "div" );
  throwing_div.id            = "throwing_div";
  throwing_div.className     = "throwing_div";
  throwing_div.innerHTML     = "&nbsp;";
  throwing_div.style.width   = window.innerWidth  + "px";
  throwing_div.style.height  = window.innerHeight + "px";
  document.body.appendChild( throwing_div );
  
}

function initialize_3d() {

  // The camera.
  
  camera = new THREE.PerspectiveCamera( 55, window.innerWidth / window.innerHeight, 1, 10000 );
  camera.up.set( 0, 0, 1 );
  camera.position.z =   55;
  camera.position.y = -195;
  camera.lookAt( new THREE.Vector3( 0, -195, 0 ) );
  camera.rotation.z = Math.PI;
  
  // The scene.

  scene = new THREE.Scene();
  
  // The renderer.
  
  renderer = new THREE.WebGLRenderer( { alpha: true } );
  renderer.setSize( window.innerWidth, window.innerHeight );  
  renderer.setClearColor( 0x000000, 0.0 );

  // Physics materials.
  
  var floor_material        = new CANNON.Material( "ground_material"       );
  var bowling_ball_material = new CANNON.Material( "bowling_ball_material" );
  var bowling_pin_material  = new CANNON.Material( "bowling_pin_material"  );
  
  // Physical contact materials.
  
  var floor_to_bowling_ball_contact_material       = new CANNON.ContactMaterial( floor_material,        bowling_ball_material, 0.2,  0.6 );  
  var floor_to_bowling_pin_contact_material        = new CANNON.ContactMaterial( floor_material,        bowling_pin_material,  0.2,  0.9 );  
  var bowling_ball_to_bowling_pin_contact_material = new CANNON.ContactMaterial( bowling_ball_material, bowling_pin_material,  0.2,  2.0 );
  var bowling_pin_to_bowling_pin_contact_material  = new CANNON.ContactMaterial( bowling_pin_material,  bowling_pin_material,  0.2,  1.5 );
  
  // JSON loader for the mesh files.
  
  var loader = new THREE.JSONLoader( true );
  
  // The bowling pin bay mesh.
  
  number_of_textures += 1;
  
  loader.load( "assets/models/bowling_pin_bay.js", function( geometry, material ) {
    
    material.shading = THREE.FlatShading;
    
    material[ 0 ].map = THREE.ImageUtils.loadTexture( "assets/models/textures/bowling_pin_bay.jpg", THREE.UVMapping, function () { textures_loaded += 1; } );
    
    var mesh = new THREE.Mesh( geometry, new THREE.MeshFaceMaterial( material ) );
    
    scene.add( mesh );

  }, "assets/models/textures/" );
  
  // The ground floor mesh.

  number_of_textures += 1;
  
  loader.load( "assets/models/floor.js", function( geometry, material ) {
    
      
    material[ 0 ].map = THREE.ImageUtils.loadTexture( "assets/models/textures/boards.jpg", THREE.UVMapping, function () { textures_loaded += 1; } );
    
    material[ 0 ].map.wrapS = THREE.RepeatWrapping;
    material[ 0 ].map.wrapT = THREE.RepeatWrapping;
    material[ 0 ].map.repeat.set( 2, 2 );
    
    var mesh = new THREE.Mesh( geometry, new THREE.MeshFaceMaterial( material ) );
    
    scene.add( mesh );
    
    var floor_shape = new CANNON.Box( new CANNON.Vec3( 28, 250, 1 ) );
    floor_body = new CANNON.RigidBody( 0, floor_shape, floor_material );
    floor_body.position.set( mesh.position.x, mesh.position.y, mesh.position.z );
    world.add( floor_body );
    
    floor_loaded = true;    

  }, "assets/models/textures/" );
  
  // The bowling pin meshes and physics bodies.

  var position_index = 0;
  
  var i = 10;
  
  number_of_textures += i;
  
  while ( i-- ) {
  
    loader.load( "assets/models/bowling_pin.js", function( geometry, material ) {
      
      material[ 0 ].map = THREE.ImageUtils.loadTexture( "assets/models/textures/bowling_pin.jpg", THREE.UVMapping, function () { textures_loaded += 1; } );
      
      var mesh = new THREE.Mesh( geometry, new THREE.MeshFaceMaterial( material ) );
      mesh.castShadow    = true;
      mesh.receiveShadow = true;
      
      mesh.position.set( bowling_pin_positions[ position_index ][ 0 ], 
             bowling_pin_positions[ position_index ][ 1 ], 
             bowling_pin_positions[ position_index ][ 2 ] );
      mesh.rotation.z = Math.PI;
      scene.add( mesh );
      
      var mass = 10;
      var box_body = new CANNON.RigidBody( mass, 
                   new CANNON.Box( new CANNON.Vec3( 3, 3, 10 ) ), 
                   bowling_pin_material );
      box_body.position.set(   mesh.position.x, 
             mesh.position.y, 
             mesh.position.z );
      box_body.quaternion.set( mesh.quaternion.x, 
             mesh.quaternion.y, 
             mesh.quaternion.z, 
             mesh.quaternion.w );
      world.add( box_body );
      
      bowling_pins.push( [ box_body, mesh ] );
      
      position_index += 1;

    }, "assets/models/textures/" );
    
  }

  // The bowling ball mesh.
  
  number_of_textures += 1;
  
  loader.load( "assets/models/bowling_ball.js", function( geometry, material ) {
    
    material[ 0 ].map = THREE.ImageUtils.loadTexture( "assets/models/textures/bowling_ball.jpg", THREE.UVMapping, function () { textures_loaded += 1; } );

    var mesh = new THREE.Mesh( geometry, new THREE.MeshFaceMaterial( material ) );
    
    mesh.castShadow    = true;
    mesh.receiveShadow = true;
    
    mesh.position.set( bowling_ball_origin[ 0 ], bowling_ball_origin[ 1 ], bowling_ball_origin[ 2 ] );
    scene.add( mesh );
    
    var mass = 15, radius = 5;
    var sphere_shape = new CANNON.Sphere( radius );
    sphere_body = new CANNON.RigidBody( mass, sphere_shape, bowling_ball_material );
    sphere_body.position.set( mesh.position.x, mesh.position.y, mesh.position.z );
    sphere_body.angularDamping = sphere_body.linearDamping = bowling_ball_damping;  
    world.add( sphere_body );
  
    bowling_ball = [ sphere_body, mesh ];
    
    bowling_ball_loaded = true;

  }, "assets/models/textures/" );
  
  // The bumpers.
  
  number_of_textures += 1;
  
  loader.load( "assets/models/bumpers.js", function( geometry, material ) {
    
    material[ 0 ].map = THREE.ImageUtils.loadTexture( "assets/models/textures/bumpers.jpg", THREE.UVMapping, function () { textures_loaded += 1; } );
    
    var mesh = new THREE.Mesh( geometry, new THREE.MeshFaceMaterial( material ) );
    
    scene.add( mesh );

  }, "assets/models/textures/" );
  
  // Lights.
  
  var ambient_light = new THREE.AmbientLight( 0x404040 );
  scene.add( ambient_light );
  
  var point_light1  = new THREE.PointLight( 0xC2E7F2, 0.8, 100 );
  point_light1.position.set(  22, -180, 45 );
  scene.add( point_light1 );
  
  var point_light2  = new THREE.PointLight( 0xC2E7F2, 0.8, 100 );
  point_light2.position.set(   0, -180, 45 );
  scene.add( point_light2 );
  
  renderer.shadowMapEnabled = true;
  renderer.shadowMapSoft    = true;
    
  spot_light                     = new THREE.SpotLight( 0xFFF5BA, 1.0 );
  spot_light.castShadow          = true;
  spot_light.shadowMapWidth      = 4096;
  spot_light.shadowMapHeight     = 4096;
  spot_light.shadowCameraNear    = 10;
  spot_light.shadowCameraFar     = 1050;
  spot_light.shadowCameraFov     = 100;
  spot_light.shadowBias          = 0.00008;
  spot_light.shadowDarkness      = 0.5;
  spot_light.shadowCameraVisible = false;
  spot_light.position.set( 200, 0, 300 );
  spot_light.lookAt( -200, 0, 0 );
  scene.add( spot_light );
  
  canvas = renderer.domElement;

  document.body.appendChild( canvas );
  
  // Projector.
  
  projector = new THREE.Projector();
  
  // Physics world.

  world = new CANNON.World();
  world.gravity.set( 0, 0, -120 );
  world.broadphase = new CANNON.NaiveBroadphase();
  
  world.solver.iterations = 10;
  
  // Bowling pin bay physics bodies.
  
  var bowling_pin_bay_back_shape = new CANNON.Box( new CANNON.Vec3( 40, 5, 25 ) );
  bowling_pin_bay_back_body = new CANNON.RigidBody( 0, bowling_pin_bay_back_shape, floor_material );
  bowling_pin_bay_back_body.position.set( 0, -280, 25 );
  world.add( bowling_pin_bay_back_body );
  
  var bowling_pin_bay_top_shape = new CANNON.Box( new CANNON.Vec3( 50, 55, 5 ) );
  bowling_pin_bay_top_body = new CANNON.RigidBody( 0, bowling_pin_bay_top_shape, floor_material );
  bowling_pin_bay_top_body.position.set( 0, -230, 55 );
  world.add( bowling_pin_bay_top_body );
  
  var bowling_pin_bay_left_shape = new CANNON.Box( new CANNON.Vec3( 5, 55, 25 ) );
  bowling_pin_bay_left_body = new CANNON.RigidBody( 0, bowling_pin_bay_left_shape, floor_material );
  bowling_pin_bay_left_body.position.set( 45, -230, 25 );
  world.add( bowling_pin_bay_left_body );
  
  var bowling_pin_bay_right_shape = new CANNON.Box( new CANNON.Vec3( 5, 55, 25 ) );
  bowling_pin_bay_right_body = new CANNON.RigidBody( 0, bowling_pin_bay_right_shape, floor_material );
  bowling_pin_bay_right_body.position.set( -45, -230, 25 );
  world.add( bowling_pin_bay_right_body );
  
  // Left and right lane bumpers.
  
  var bumper_right_shape = new CANNON.Box( new CANNON.Vec3( 5, 212.5, 10 ) );
  bumper_right_body = new CANNON.RigidBody( 0, bumper_right_shape, floor_material );
  bumper_right_body.position.set( -45, 37.5, 10 );
  world.add( bumper_right_body );
  
  var bumper_left_shape = new CANNON.Box( new CANNON.Vec3( 5, 212.5, 10 ) );
  bumper_left_body = new CANNON.RigidBody( 0, bumper_left_shape, floor_material );
  bumper_left_body.position.set( 45, 37.5, 10 );
  world.add( bumper_left_body );
  
  // Add the contact materials.
  
  world.addContactMaterial( floor_to_bowling_ball_contact_material       );
  world.addContactMaterial( floor_to_bowling_pin_contact_material        );
  world.addContactMaterial( bowling_ball_to_bowling_pin_contact_material );
  world.addContactMaterial( bowling_pin_to_bowling_pin_contact_material  );
  
  // The throwing direction arrow and target indicator;
  
  var arrow_direction      = new THREE.Vector3( 0, 0, 0 );
  var arrow_origin         = new THREE.Vector3( bowling_ball_origin[ 0 ], bowling_ball_origin[ 1 ], -20 );
  var arrow_length         = 0.00001;
  var arrow_color          = 0x555555;
  var arrow_head_length    = 5;
  var arrow_head_width     = 2.5;
  throwing_direction_arrow = new THREE.ArrowHelper( arrow_direction, arrow_origin, arrow_length, arrow_color, arrow_head_length, arrow_head_width );
  throwing_direction_arrow.cone.material = new THREE.MeshLambertMaterial( { color: 0xffffff, transparent: true, opacity: 0.5 } );
  throwing_direction_arrow.visible = false;
  scene.add( throwing_direction_arrow );
  
  var geometry    = new THREE.SphereGeometry( 5, 8, 8 );
  var material    = new THREE.MeshLambertMaterial( { color: 0x00ff00, transparent: true, opacity: 0.6 } );
  throwing_target = new THREE.Mesh( geometry, material );
  throwing_target.position.set( 0, 0, -20 );
  scene.add( throwing_target );
  
  // Events.
  
  throwing_div.onmousedown = on_mouse_down;
  throwing_div.onmouseup   = on_mouse_up;
  
  window.onmousemove       = on_mouse_move;  
  window.onresize          = on_resize;
  
  // Draw the first frame.

  draw_frame();
}

function initialize_opening_sequence() {
  if ( textures_loaded != number_of_textures ) {
    window.setTimeout( function () {
      initialize_opening_sequence();
    }, 100 );
  }
  else {
    loading_div.style.visibility = "hidden";
    camera.position.y = throwing_view.position.y;
    camera.position.z = throwing_view.position.z;

    camera.lookAt( new THREE.Vector3( 0, throwing_view.look_at.y, 0 ) );
  }
}
  

function draw_frame() {
  requestAnimationFrame( draw_frame );
  handle_3d();
}

function handle_3d() {
  if ( floor_loaded == false || bowling_ball_loaded == false ) return; 
  
  physics_step();
  
  track_mouse();
  
  monitor_bowling_ball();
  monitor_bowling_pins();

  renderer.render( scene, camera );
}

function physics_step() {
  world.step( 1.0 / 60.0 );

  bowling_ball[ 0 ].position.copy(   bowling_ball[ 1 ].position   );
  bowling_ball[ 0 ].quaternion.copy( bowling_ball[ 1 ].quaternion );

  var i = bowling_pins.length;
  
  while ( i-- ) {
    bowling_pins[ i ][ 0 ].position.copy(   bowling_pins[ i ][ 1 ].position   );
    bowling_pins[ i ][ 0 ].quaternion.copy( bowling_pins[ i ][ 1 ].quaternion );
  }
}

function track_mouse() {
  if ( bowling_ball_thrown == false ) {
    bowling_ball[ 0 ].velocity.set( 0, 0, 0 );
    bowling_ball[ 0 ].angularVelocity.set( 0.0, 0.0, 0.0 );
    bowling_ball[ 0 ].force.set( 0, 0, 1200 );
    
    if ( mouse_is_down == false && mouse_positions.length > 2 && play == true ) {
      var mouse_position_3d = screen_position_2d_to_3d( mouse_positions[ mouse_positions.length - 1 ][ 0 ], mouse_positions[ mouse_positions.length - 1 ][ 1 ], bowling_ball[ 1 ].position.z );
      
      if ( mouse_position_3d.y >= 177 && mouse_position_3d.y <= 201 ) {
        var bx = bowling_ball[ 1 ].position.x;
        var by = bowling_ball[ 1 ].position.y;
        var bz = bowling_ball[ 1 ].position.z;
        
        var xd = mouse_position_3d.x - bx;
        
        var s = xd / Math.abs( xd );
        
        bowling_ball[ 0 ].velocity.set( s * ( xd * xd ), 0, 0 );
      }
      
      if ( bowling_ball[ 0 ].position.x >= 35.0 ) {
        bowling_ball[ 1 ].position.x = 34.9;
        
        bowling_ball[ 0 ].position.set( bowling_ball[ 1 ].position.x, 
                bowling_ball[ 1 ].position.y, 
                bowling_ball[ 1 ].position.z );
        bowling_ball[ 0 ].quaternion =  bowling_ball[ 1 ].quaternion;
        bowling_ball[ 0 ].velocity.set( 0, 0, 0 );
        bowling_ball[ 0 ].angularVelocity.set( 0.0, 0.0, 0.0 );
        bowling_ball[ 0 ].force.set( 0, 0, 1200 );
      }
      else if ( bowling_ball[ 0 ].position.x <= -35.0 ) {
        bowling_ball[ 1 ].position.x = -34.9;
        
        bowling_ball[ 0 ].position.set( bowling_ball[ 1 ].position.x, 
                bowling_ball[ 1 ].position.y, 
                bowling_ball[ 1 ].position.z );
        bowling_ball[ 0 ].quaternion =  bowling_ball[ 1 ].quaternion;
        bowling_ball[ 0 ].velocity.set( 0, 0, 0 );        
        bowling_ball[ 0 ].angularVelocity.set( 0.0, 0.0, 0.0 );
        bowling_ball[ 0 ].force.set( 0, 0, 1200 );
      }
    }

    bowling_ball_last_updated_position = [ 
      bowling_ball[ 1 ].position.x,
      bowling_ball[ 1 ].position.y,
      bowling_ball[ 1 ].position.z
    ];
  }
}

// Event callbacks.

function on_mouse_move( event ) {
  
  mouse_is_moving = true;
  
  mouse_positions.push( [ event.clientX, event.clientY ] );
  
  if ( mouse_positions.length >= 100 ) {
    mouse_positions = mouse_positions.splice( mouse_positions.length - 50, mouse_positions.length );
  }
  
  if ( mouse_is_down && on_mouse_down_mouse_on_ball ) {
    // no-op
  }
  else {
    throwing_direction_arrow.position.z = -20;
    throwing_direction_arrow.setDirection( new THREE.Vector3( 0, 0, 0 ) );
    throwing_target.position.set( 0, 0, -20 );
  }
}

function on_mouse_down( event ) {
  mouse_is_down = true;

  on_mouse_down_time = ( new Date() ).valueOf();
  on_mouse_down_position = [ event.clientX, event.clientY ];
  
  if ( mouse_3d_intersection( event.clientX, event.clientY ).id == bowling_ball[ 1 ].id ) {
    on_mouse_down_mouse_on_ball = true;
  }
  else {
    on_mouse_down_mouse_on_ball = false;
  }
}

function on_mouse_up( event ) {
  mouse_is_down = false;
  
  if ( play == false ) return;
  
  if ( bowling_ball_thrown == true ) {
    reset_bowling_ball();
    return;
  }
  
  if ( on_mouse_down_mouse_on_ball == false ) return;
  
  on_mouse_down_mouse_on_ball = false;
  
  var x1 = on_mouse_down_position[ 0 ];
  var y1 = on_mouse_down_position[ 1 ];
  
  var x2 = event.clientX;
  var y2 = event.clientY;
  
  var position1 = screen_position_2d_to_3d( x1, y1, 0 );
  var position2 = screen_position_2d_to_3d( x2, y2, 0 );
  
  if ( y2 - y1 > 0 ) return;
  
  var translate_x = bowling_ball_last_updated_position[ 0 ] - position1.x;
  var translate_y = bowling_ball_last_updated_position[ 1 ] - position1.y;
  
  position1.x += translate_x;
  position1.y += translate_y;
  
  position2.x += translate_x;
  position2.y += translate_y;
  
  var xd = position2.x - position1.x;
  var yd = position2.y - position1.y;
  
  var x = xd;
  var y = yd;
  
  var l = Math.sqrt( ( xd * xd ) + ( yd * yd ) );
  
  if ( l != 0.0 ) {
    x = xd / l;
    y = yd / l;
  }
  
  if ( y > 0 ) {
    y *= -1;
    x *= -1;
  }
  
  var power = 200000;
  
  var fx = x * power;
  var fy = y * power;

  bowling_ball[ 0 ].applyForce( new CANNON.Vec3( fx, fy, 0.0 ), 
              new CANNON.Vec3( bowling_ball_origin[ 0 ], 
                   bowling_ball_origin[ 1 ], 
                   bowling_ball_origin[ 2 ] + 5 ) );
  
  current_round_throws += 1;
  
  bowling_ball_thrown = true;
  switching_view = true;
    
  var timer = window.setTimeout( function () { switch_to_bowling_pin_view(); }, 1200 );
  timers.push( timer );
  clear_old_timers();
  
  if ( power > 1 && l > 0.0001 ) {
    roll_sound_effect.stop();
    roll_sound_effect.play();
  }
}

function on_resize() {
  renderer.setSize( window.innerWidth, window.innerHeight );

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  
  throwing_div.style.width   = window.innerWidth  + "px";
  throwing_div.style.height  = window.innerHeight + "px";
}

function monitor_bowling_ball() {
  if ( bowling_ball[ 1 ].position.y <= -240  ||
       bowling_ball[ 1 ].position.y >= 240   ||
       bowling_ball[ 1 ].position.z < -15    ||
       isNaN( bowling_ball[ 1 ].position.x ) ||
       isNaN( bowling_ball[ 1 ].position.y ) ||
       isNaN( bowling_ball[ 1 ].position.z )  )
  {
    reset_bowling_ball();
  }
}

function reset_bowling_ball() {
  bowling_ball[ 1 ].position.set( bowling_ball_origin[ 0 ], 
          bowling_ball_origin[ 1 ], 
          bowling_ball_origin[ 2 ] );
  bowling_ball[ 1 ].rotation.set( 0, 
          0, 
          0 );
  bowling_ball[ 0 ].position.set( bowling_ball[ 1 ].position.x, 
          bowling_ball[ 1 ].position.y, 
          bowling_ball[ 1 ].position.z );
  bowling_ball[ 0 ].quaternion =  bowling_ball[ 1 ].quaternion;
  bowling_ball[ 0 ].angularVelocity.set( 0, 0, 0 );
  bowling_ball[ 0 ].velocity.set( 0, 0, 0 );
  bowling_ball[ 0 ].force.set( 0, 0, 1200 );
  
  bowling_ball_thrown = false;
  switching_view = true;
  switch_to_throw_view();
}

function monitor_bowling_pins() {
  if ( resetting_bowling_pins == true || bowling_pins.length == 0 || play == false ) return;  
  
  var resets = 0;
  var angle = 15;
  var distance = 5;
  var i = bowling_pins.length;
  
  while ( i-- ) {
    var bowling_pin = bowling_pins[ i ];
    
    if ( Math.abs( bowling_pin[ 1 ].rotation.x * 180 / Math.PI ) >= angle || 
         Math.abs( bowling_pin[ 1 ].rotation.y * 180 / Math.PI ) >= angle || 
         Math.abs( bowling_pin[ 1 ].position.x - bowling_pin[ 0 ].initPosition.x ) > distance ||
         Math.abs( bowling_pin[ 1 ].position.y - bowling_pin[ 0 ].initPosition.y ) > distance ||
         Math.abs( bowling_pin[ 1 ].position.z - bowling_pin[ 0 ].initPosition.z ) > distance )
    {
      resets += 1;
      
      bowling_pins_reset = false;
      
      if ( bowling_pin[ 1 ].visible ) {
        hit_bowling_pins.push( i );
      }
    }
  }
  
  if ( hit_bowling_pins.length > 0 && ( new Date() ).valueOf() - hit_sound_effect_played > 2000 ) {
    hit_sound_effect.stop();
    hit_sound_effect.play();
    hit_sound_effect_played = ( new Date() ).valueOf();
  }

  if ( hit_bowling_pins.length != 0 ) {
    window.setTimeout( function () {
      if ( bowling_pins_reset == true ) return;
    
      var i = hit_bowling_pins.length;
      
      while ( i-- ) {
        bowling_pins[ hit_bowling_pins[ i ] ][ 1 ].visible = false;
        bowling_pins[ hit_bowling_pins[ i ] ][ 0 ].collisionFilterGroup = 2;
      }
      hit_bowling_pins = [ ];
    }, 1500 );
  }  
  
  if ( resets == bowling_pins.length ) {
    resetting_bowling_pins = true;
    
    var timer = window.setTimeout( function () {
      reset_bowling_pins();
      reset_bowling_ball();
      current_round_throws = 0;
    }, 10 );
    
    timers.push( timer );
    clear_old_timers();
  }
}

function reset_bowling_pins() {
  var i = bowling_pins.length;
      
  while ( i-- ) {
    var bowling_pin          = bowling_pins[ i ];
    var bowling_pin_position = bowling_pin_positions[ i ];
  
    bowling_pin[ 1 ].position.set( bowling_pin_position[ 0 ], 
                 bowling_pin_position[ 1 ], 
                 bowling_pin_position[ 2 ] );
    
    bowling_pin[ 1 ].rotation.set( 0, 0, Math.PI );
    
    bowling_pin[ 0 ].position.set(   bowling_pin[ 1 ].position.x,  
             bowling_pin[ 1 ].position.y,  
             bowling_pin[ 1 ].position.z   );
    bowling_pin[ 0 ].quaternion.set( bowling_pin[ 1 ].quaternion.x, 
             bowling_pin[ 1 ].quaternion.y, 
             bowling_pin[ 1 ].quaternion.z, 
             bowling_pin[ 1 ].quaternion.w );
    
    bowling_pin[ 0 ].angularVelocity.set( 0, 0, 0 );
    bowling_pin[ 0 ].velocity.set( 0, 0, 0 );
    bowling_pin[ 0 ].force.set( 0, 0, 0 );
    
    bowling_pin[ 1 ].visible = true;
  
    bowling_pin[ 0 ].collisionFilterGroup = 1;
  
  }
  
  hit_bowling_pins.length = 0;
  hit_bowling_pins        = [ ];
  
  resetting_bowling_pins = false;
  
  bowling_pins_reset = true;
}

function switch_to_throw_view() {
  camera.up.set( 0, 0, 1 );
  camera.position.z = throwing_view.position.z;
  camera.position.y = throwing_view.position.y;
  camera.lookAt( new THREE.Vector3( throwing_view.look_at.x, throwing_view.look_at.y, throwing_view.look_at.z ) );
  
  current_view = "throw";
  
  switching_view = false;
}

function switch_to_bowling_pin_view() {
  if ( bowling_ball[ 1 ].position.y == bowling_ball_origin[ 1 ] ) return;  
  
  camera.position.z = bowling_pin_view.position.z;
   camera.position.y = bowling_pin_view.position.y;
   camera.lookAt( new THREE.Vector3( bowling_pin_view.look_at.x, bowling_pin_view.look_at.y, bowling_pin_view.look_at.z ) );
   camera.rotation.z = Math.PI;
  
  current_view = "bowling_pin";
  
  switching_view = false;
}

window.onload = initialize;

// Utilities.

function clear_old_timers() {
  var i = timers.length;  
  
  if ( i == 1 ) return;
  
  i -= 1;  
  
  while ( i-- ) {
    window.clearTimeout( timers[ i ] );
  }
  
  timers = [ timers[ timers.length - 1 ] ];
  
}

function screen_position_2d_to_3d( x, y, z_plane ) {
  if ( z_plane == undefined ) z_plane = 0;
  
  var vector = new THREE.Vector3();
  
  vector.x =  ( x / window.innerWidth  ) * 2 - 1;
  vector.y = -( y / window.innerHeight ) * 2 + 1;
  vector.z = 0.5;
  
  projector.unprojectVector( vector, camera );
  
  var direction   =  vector.sub( camera.position ).normalize();
  var distance    = -camera.position.z / direction.z;
  var position_3d =  camera.position.clone().add( direction.multiplyScalar( distance - z_plane ) );
  
  return position_3d;
}

function mouse_3d_intersection( x, y ) {
  var mouse_coordinates = new THREE.Vector3();
  
  mouse_coordinates.x =     2 * ( x / window.innerWidth  ) - 1;
  mouse_coordinates.y = 1 - 2 * ( y / window.innerHeight );
  mouse_coordinates.z = 0.5;
  
  var ray = projector.pickingRay( mouse_coordinates, camera );
  var objects = ray.intersectObjects( scene.children );
  
  if( objects.length ) {
    return objects[ 0 ].object;
  }
}
