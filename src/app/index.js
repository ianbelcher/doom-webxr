import AFRAME from 'aframe';
import 'aframe-teleport-controls';
import 'aframe-mobile-controls';

// Window globals
/* global window, document, DeviceMotionEvent */
// Dependency globals
/* global THREE */
// Configuration globals
/* global startPosition */

AFRAME.registerComponent('sector', {
  schema: {
    vertices: {
      default: ['-10 10', '-10 -10', '10 -10'],
    },
    height: { default: 10 },
    face: { default: 'floor' },
  },

  init() {
    const { data } = this;

    const pts = [];
    for (let i = 0; i < data.vertices.length; i += 1) {
      const points = data.vertices[i].split(' ').map(x => parseFloat(x));
      pts.push(new THREE.Vector2(points[0], points[1] * (this.data.face === 'floor' ? -1 : 1)));
    }
    const shape = new THREE.Shape(pts);

    const extrudeSettings = {
      depth: 0,
      steps: 0,
      bevelEnabled: false,
      // bevelEnabled: true, bevelSegments: 8, steps: 8, bevelSize: 0.1, bevelThickness: 0.1
    };
    this.geometry = new THREE.ExtrudeBufferGeometry(shape, extrudeSettings);
    this.geometry.lookAt(new THREE.Vector3(0, this.data.face === 'ceiling' ? 10000 : -10000, 0));
    this.mesh = new THREE.Mesh(this.geometry);
    this.mesh.position.y = this.data.height;
    this.el.setObject3D('mesh', this.mesh);
  },
});

let updateSpriteAnglesTimeout;
const updateSpriteAngles = ({ x: cx, z: cz }) => {
  const worker = async () => {
    document.querySelectorAll('.sprite').forEach((sprite) => {
      const { x: sx, z: sz } = sprite.getAttribute('position');
      const angle = Math.atan2(cx - sx, cz - sz);
      // This call has side effects... This is the best and most effective way of doing the change.
      /* eslint-disable-next-line no-param-reassign */
      sprite.object3D.rotation.y = angle;
    });
  };
  // Throttled late-worker pattern.
  const later = () => {
    updateSpriteAnglesTimeout = null;
    worker();
  };
  if (!updateSpriteAnglesTimeout) {
    updateSpriteAnglesTimeout = setTimeout(later, 500);
  }
};

let wasdDisabled = false;

AFRAME.registerComponent('listener', {
  tick() {
    if (!wasdDisabled) {
      const position = this.el.getAttribute('position');
      updateSpriteAngles({ x: position.x + startPosition.x, z: position.z + startPosition.z * -1 });
    }
  },
});

window.addEventListener('DOMContentLoaded', () => {
  const cameraRigElement = document.getElementById('cameraRig');
  cameraRigElement.addEventListener('teleported', (event) => {
    wasdDisabled = true;
    updateSpriteAngles(event.detail.newPosition);
  });
  // Request permission to access the devices motion sensors if there has been a touch event
  // (and we're most likely on a mobile device)
  document.addEventListener('touchend', DeviceMotionEvent.requestPermission);
});
