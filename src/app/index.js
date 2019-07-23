import AFRAME from 'aframe';
import 'aframe-teleport-controls';
import 'aframe-mobile-controls';

// Window globals
/* global window, document */
// Dependency globals
/* global THREE */
// Configuration globals
/* global startPosition */

let chromeBrowser = false;
// @see https://stackoverflow.com/a/13348618/981598
// please note,
// that IE11 now returns undefined again for window.chrome
// and new Opera 30 outputs true for window.chrome
// but needs to check if window.opr is not undefined
// and new IE Edge outputs to true now for window.chrome
// and if not iOS Chrome check
// so use the below updated condition
const isChromium = window.chrome;
const winNav = window.navigator;
const vendorName = winNav.vendor;
const isOpera = typeof window.opr !== 'undefined';
const isIEedge = winNav.userAgent.indexOf('Edge') > -1;
const isIOSChrome = winNav.userAgent.match('CriOS');

if (isIOSChrome) {
  chromeBrowser = true;
} else if (
  isChromium !== null
  && typeof isChromium !== 'undefined'
  && vendorName === 'Google Inc.'
  && isOpera === false
  && isIEedge === false
) {
  chromeBrowser = true;
} else {
  // not Google Chrome
}

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

const updateSpriteAngles = ({ x: cx, z: cz }) => {
  document.querySelectorAll('.sprite').forEach((sprite) => {
    const { x: sx, z: sz } = sprite.getAttribute('position');
    const angle = Math.atan2(cx - sx, cz - sz);
    // This call has side effects... This is the best and most effective way of doing the change.
    /* eslint-disable-next-line no-param-reassign */
    sprite.object3D.rotation.y = angle;
  });
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

  const removeIntroScreen = () => {
    const introScreen = document.getElementById('introScreen');
    if (introScreen) {
      introScreen.parentElement.removeChild(introScreen);
      document.removeEventListener('keypress', removeIntroScreen);
    }
  };
  const removeIntroScreenFromEvent = (e) => {
    if (e.target && e.target.id === 'introScreen') {
      removeIntroScreen();
      document.removeEventListener('mousedown', removeIntroScreenFromEvent);
      document.removeEventListener('touchstart', removeIntroScreenFromEvent);
    }
  };

  document.addEventListener('keypress', removeIntroScreen);
  document.addEventListener('mousedown', removeIntroScreenFromEvent);
  document.addEventListener('touchstart', removeIntroScreenFromEvent);

  if (chromeBrowser) {
    document.getElementById('chromeWarning').style.display = 'block';
  }

  document.getElementById('levelSelect').addEventListener('change', (event) => {
    window.location = `/${event.target.value}.html`;
  });
});
