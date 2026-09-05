/**
 * HumanEyeCortex - Biomechanical & Neurobiological Agent Vision Subsystem
 * 
 * Implements the complete set of closed-form mathematical equations of the human visual system:
 * 1. Retinal Topography & Log-Polar Foveated Spatial Sampling (Schwartz M-Scaling)
 * 2. Oculomotor Kinematics & Saccadic Main Sequence (Bahill et al., Carpenter LATER)
 * 3. Fixational Micro-Movements (Tremor, Brownian Drift, Microsaccades)
 * 4. Multi-Scale Salience Field (Itti-Koch Conspicuity ⊗ Task-Driven Bayesian Priors)
 * 5. Visual Deictic Grounding & Joint Attention Triangulation (Land & Hayhoe, Tomasello)
 * 6. Cognitive Pupillometry & Autonomic Workload Estimation (Kahneman, Hess & Polt)
 * 7. Listing's Law of 3D Ocular Kinematics & Torsion (Listing 1853, Tweed & Vilis 1990)
 * 8. Vestibulo-Ocular Reflex (VOR) & Head-Eye Gaze Decomposition (Robinson 1981)
 * 9. Smooth Pursuit Dynamics & Catch-Up Saccades (Lisberger 1987, Krauzlis 2004)
 * 10. Dynamic Visual Acuity (DVA) & Retinal Slip Velocity (Landis 1954, Kelly 1979)
 * 11. Binocular Vergence & Stereoscopic Depth (Cumming & DeAngelis 2001)
 * 12. Contrast Sensitivity Function (CSF) & Spatial Frequency Bandpass (Campbell & Robson 1968)
 */

class HumanEyeCortex {
  constructor(options = {}) {
    this.screenWidth = options.screenWidth || 1920;
    this.screenHeight = options.screenHeight || 1080;
    this.mode = options.mode || 'human_biological';
    this.humanEyeActive = true;

    // 1. Gaze & Foveal State (Normalized [0, 1])
    this.currentGaze = { x: 0.5, y: 0.5 };
    this.targetGaze = { x: 0.5, y: 0.5 };
    this.gazeVelocity = { vx: 0.0, vy: 0.0 }; // deg/s
    this.lastGazeUpdate = Date.now();

    // 2. Oculomotor Kinematic Constants (Main Sequence)
    this.V_MAX = 700.0; // deg/s
    this.A_0 = 2.0;     // deg
    this.D_0 = 20.0;    // ms
    this.K_S = 2.5;     // ms/deg
    this.isSaccading = false;
    this.saccadeStartTime = 0;
    this.saccadeDuration = 0;
    this.saccadicSuppression = 0.0;

    // 3. Fixational Movement State (Tremor, Drift, Microsaccades)
    this.driftState = { x: 0.0, y: 0.0 };
    this.lastFixationTime = Date.now();
    this.DRIFT_GAMMA = 0.45; // Mean reversion rate
    this.DRIFT_SIGMA = 0.002; // Stochastic noise intensity
    this.MICROSACCADE_THRESH = 0.015; // Normalized displacement threshold

    // 4. Salience & Deictic State
    this.userCursor = { x: 0.5, y: 0.5, vx: 0.0, vy: 0.0, active: false };
    this.userEyeGaze = { x: 0.5, y: 0.5, confidence: 0.0 };
    this.activeHotzones = []; // [{ x, y, width, height, weight, label }]

    // 5. Cognitive Pupillometry State
    this.baselinePupilMm = 3.5;
    this.currentPupilMm = 3.5;
    this.ambientLuminance = 0.5; // [0, 1]
    this.estimatedCognitiveLoad = 0.2; // [0, 1]
    this.bondingVibeFactor = 0.8;

    // 6. Head-Eye VOR & 3D Listing's Law State
    this.headOrientation = { pitch: 0.0, yaw: 0.0, roll: 0.0 }; // radians
    this.headAngularVelocity = { pitch: 0.0, yaw: 0.0, roll: 0.0 }; // rad/s
    this.interpupillaryDistMm = options.ipdMm || 63.0; // Primate average 63mm
    this.viewingDistanceMm = options.distanceMm || 600.0; // Desk monitor ~60cm
  }

  // ===========================================================================
  // 1. RETINAL TOPOGRAPHY & FOVEATED SAMPLING (Schwartz M-Scaling)
  // ===========================================================================

  /**
   * Computes human cortical magnification M(r) and visual acuity at coordinate (x, y)
   * given current foveal gaze center g = (gx, gy).
   * 
   * Equation: Acuity(x, g) = clamp(exp(-||x - g||^2 / (2 * sigma_fovea^2)) + kappa_periph, 0.05, 1.0)
   */
  computeFovealAcuity(x, y, gaze = this.currentGaze) {
    const dx = x - gaze.x;
    const dy = y - gaze.y;
    const distSq = dx * dx + dy * dy;
    const sigmaFovea = 0.08; // ~1.5 to 2.0 degrees normalized visual angle
    const kappaPeriph = 0.08; // Peripheral rod floor

    const acuity = Math.exp(-distSq / (2 * sigmaFovea * sigmaFovea)) + kappaPeriph;
    return Math.min(1.0, Math.max(0.05, acuity));
  }

  /**
   * Computes optimal foveated crop bounding box for screen capture
   * centered around current gaze point.
   */
  getFoveatedCropBox(fullWidth = this.screenWidth, fullHeight = this.screenHeight, foveaScale = 0.35) {
    const cropW = Math.round(fullWidth * foveaScale);
    const cropH = Math.round(fullHeight * foveaScale);

    const centerX = Math.round(this.currentGaze.x * fullWidth);
    const centerY = Math.round(this.currentGaze.y * fullHeight);

    const minX = Math.max(0, Math.min(fullWidth - cropW, centerX - Math.round(cropW / 2)));
    const minY = Math.max(0, Math.min(fullHeight - cropH, centerY - Math.round(cropH / 2)));

    return {
      x: minX,
      y: minY,
      width: cropW,
      height: cropH,
      center: { x: centerX, y: centerY },
      fovealAcuity: this.computeFovealAcuity(this.currentGaze.x, this.currentGaze.y)
    };
  }

  // ===========================================================================
  // 2. OCULOMOTOR KINEMATICS & SACCADIC MAIN SEQUENCE
  // ===========================================================================

  /**
   * Calculates ballistic saccade parameters using Bahill et al. Main Sequence equations.
   * 
   * V_peak(A) = (V_max * A) / (A_0 + A)
   * Duration D(A) = D_0 + K_s * A
   */
  computeSaccadeDynamics(fromX, fromY, toX, toY) {
    const dx = (toX - fromX) * 45.0; // Approx 45 deg FOV across screen
    const dy = (toY - fromY) * 30.0;
    const amplitudeDeg = Math.sqrt(dx * dx + dy * dy);

    if (amplitudeDeg < 0.1) {
      return { amplitudeDeg: 0, peakVelocity: 0, durationMs: 0, suppression: 0 };
    }

    const peakVelocity = (this.V_MAX * amplitudeDeg) / (this.A_0 + amplitudeDeg);
    const durationMs = this.D_0 + this.K_S * amplitudeDeg;
    const suppressionFactor = Math.min(0.85, 0.40 + 0.05 * amplitudeDeg);

    return {
      amplitudeDeg: Math.round(amplitudeDeg * 100) / 100,
      peakVelocity: Math.round(peakVelocity * 10) / 10,
      durationMs: Math.round(durationMs * 10) / 10,
      suppressionFactor: Math.round(suppressionFactor * 100) / 100
    };
  }

  /**
   * Carpenter's LATER Decision Model for Saccade Latency
   * S(t) = S_0 + r_s * t, where r_s ~ N(mu_r, sigma_r^2)
   */
  sampleSaccadicLatency(urgency = 1.0) {
    const mu_r = 0.005 * urgency; // Baseline accumulation rate (1/ms)
    const sigma_r = 0.001;
    // Box-Muller transform for normal distribution
    const u1 = Math.max(1e-6, Math.random());
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    const rate = Math.max(0.001, mu_r + z0 * sigma_r);

    const threshold = 1.0;
    const latencyMs = threshold / rate;
    return Math.max(80, Math.min(450, Math.round(latencyMs)));
  }

  // ===========================================================================
  // 3. FIXATIONAL MICRO-MOVEMENTS (Tremor, Drift, Microsaccades)
  // ===========================================================================

  /**
   * Computes instantaneous fixational jitter offset (Tremor + Drift + Microsaccade).
   * Prevents static artificial blindness.
   */
  computeFixationalOffset(timeMs = Date.now()) {
    const tSec = timeMs / 1000.0;

    // High frequency physiological tremor (50 Hz & 75 Hz harmonic)
    const tremorX = 0.0008 * Math.sin(2 * Math.PI * 50 * tSec) + 0.0004 * Math.sin(2 * Math.PI * 75 * tSec);
    const tremorY = 0.0008 * Math.cos(2 * Math.PI * 50 * tSec) + 0.0004 * Math.cos(2 * Math.PI * 75 * tSec);

    // Ornstein-Uhlenbeck Brownian drift
    const dt = 0.016; // 16ms delta
    const randNoiseX = (Math.random() - 0.5) * 2 * this.DRIFT_SIGMA;
    const randNoiseY = (Math.random() - 0.5) * 2 * this.DRIFT_SIGMA;

    this.driftState.x += -this.DRIFT_GAMMA * this.driftState.x * dt + randNoiseX;
    this.driftState.y += -this.DRIFT_GAMMA * this.driftState.y * dt + randNoiseY;

    // Check for corrective microsaccade trigger
    const driftMag = Math.sqrt(this.driftState.x ** 2 + this.driftState.y ** 2);
    let microsaccadeX = 0;
    let microsaccadeY = 0;

    if (driftMag >= this.MICROSACCADE_THRESH) {
      // Rapid corrective flick back toward center
      microsaccadeX = -this.driftState.x * 0.85;
      microsaccadeY = -this.driftState.y * 0.85;
      this.driftState.x *= 0.15;
      this.driftState.y *= 0.15;
    }

    return {
      x: tremorX + this.driftState.x + microsaccadeX,
      y: tremorY + this.driftState.y + microsaccadeY,
      isMicrosaccade: driftMag >= this.MICROSACCADE_THRESH
    };
  }

  // ===========================================================================
  // 4. MULTI-SCALE SALIENCE & VISUAL DEICTIC TRIANGULATION
  // ===========================================================================

  /**
   * Updates user cursor and webcam eye tracking vectors.
   */
  updateUserInputs(cursor = null, eyeGaze = null) {
    if (cursor) {
      const prevX = this.userCursor.x;
      const prevY = this.userCursor.y;
      const now = Date.now();
      const dt = Math.max(0.001, (now - this.lastGazeUpdate) / 1000.0);

      const nextX = Math.max(0, Math.min(1, cursor.x));
      const nextY = Math.max(0, Math.min(1, cursor.y));

      this.userCursor = {
        x: nextX,
        y: nextY,
        vx: (nextX - prevX) / dt * 45.0, // deg/s
        vy: (nextY - prevY) / dt * 30.0,
        active: cursor.active !== undefined ? cursor.active : true
      };
    }
    if (eyeGaze) {
      this.userEyeGaze = {
        x: Math.max(0, Math.min(1, eyeGaze.x)),
        y: Math.max(0, Math.min(1, eyeGaze.y)),
        confidence: eyeGaze.confidence || 0.8
      };
    }
  }

  /**
   * Registers or updates active IDE / terminal visual hotzones.
   */
  setHotzones(zones = []) {
    this.activeHotzones = zones.map(z => ({
      x: z.x || 0,
      y: z.y || 0,
      width: z.width || 0.2,
      height: z.height || 0.2,
      weight: z.weight || 1.0,
      label: z.label || "code_hotzone"
    }));
  }

  /**
   * Triangulates Joint Attention & Deictic Focus Target.
   * 
   * Equation:
   * P_joint = argmax [ w_c * G(x; p_cursor) + w_g * G(x; p_gaze) + w_t * Hotzones(x) ]
   */
  evaluateJointAttention() {
    let weightedSumX = 0.0;
    let weightedSumY = 0.0;
    let totalWeight = 0.0;

    const w_cursor = this.userCursor.active ? 0.45 : 0.0;
    const w_gaze = this.userEyeGaze.confidence > 0.3 ? 0.35 * this.userEyeGaze.confidence : 0.0;
    const w_hotzone = this.activeHotzones.length > 0 ? 0.20 : 0.0;

    if (w_cursor > 0) {
      weightedSumX += this.userCursor.x * w_cursor;
      weightedSumY += this.userCursor.y * w_cursor;
      totalWeight += w_cursor;
    }

    if (w_gaze > 0) {
      weightedSumX += this.userEyeGaze.x * w_gaze;
      weightedSumY += this.userEyeGaze.y * w_gaze;
      totalWeight += w_gaze;
    }

    if (w_hotzone > 0) {
      const topZone = this.activeHotzones.reduce((prev, curr) => (curr.weight > prev.weight ? curr : prev), this.activeHotzones[0]);
      const zoneCenterX = topZone.x + topZone.width / 2;
      const zoneCenterY = topZone.y + topZone.height / 2;
      weightedSumX += zoneCenterX * w_hotzone * topZone.weight;
      weightedSumY += zoneCenterY * w_hotzone * topZone.weight;
      totalWeight += w_hotzone * topZone.weight;
    }

    let targetX = 0.5;
    let targetY = 0.5;
    if (totalWeight > 0) {
      targetX = weightedSumX / totalWeight;
      targetY = weightedSumY / totalWeight;
    }

    // Clamp within screen bounds
    targetX = Math.max(0.05, Math.min(0.95, targetX));
    targetY = Math.max(0.05, Math.min(0.95, targetY));

    // Deictic Alignment Quality Metric
    const distToCursor = Math.sqrt((this.currentGaze.x - this.userCursor.x) ** 2 + (this.currentGaze.y - this.userCursor.y) ** 2);
    const deicticQuality = Math.exp(-distToCursor / 0.35);

    return {
      jointFocus: { x: targetX, y: targetY },
      deicticAlignmentQuality: Math.round(deicticQuality * 100) / 100,
      totalWeight: Math.round(totalWeight * 100) / 100
    };
  }

  // ===========================================================================
  // 5. COGNITIVE PUPILLOMETRY & AUTONOMIC WORKLOAD INDEX
  // ===========================================================================

  /**
   * Computes biological pupil diameter and extracts estimated mental cognitive load.
   * 
   * d_p(t) = d_baseline - Delta_PLR(L) + Delta_cog(CLI) + Delta_affect(Vibe)
   */
  updatePupillometry(ambientLuminance = 0.5, cognitiveLoadInput = 0.2, vibeScore = 0.8) {
    this.ambientLuminance = Math.max(0, Math.min(1, ambientLuminance));
    this.estimatedCognitiveLoad = Math.max(0, Math.min(1, cognitiveLoadInput));
    this.bondingVibeFactor = Math.max(0, Math.min(1, vibeScore));

    // Pupillary Light Reflex (constriction with brightness)
    const deltaPLR = 1.2 * Math.log(1.0 + this.ambientLuminance * 3.0);

    // Cognitive Workload Dilation Index (CWDI)
    const deltaCog = 0.9 / (1.0 + Math.exp(-6.0 * (this.estimatedCognitiveLoad - 0.5)));

    // Affective/Bonding Dilation (empathetic resonance)
    const deltaAffect = 0.3 * this.bondingVibeFactor;

    this.currentPupilMm = Math.max(2.0, Math.min(8.0, this.baselinePupilMm - deltaPLR + deltaCog + deltaAffect));

    return {
      pupilDiameterMm: Math.round(this.currentPupilMm * 100) / 100,
      workloadIndex: Math.round(this.estimatedCognitiveLoad * 100) / 100,
      dilationDeltaMm: Math.round((this.currentPupilMm - this.baselinePupilMm) * 100) / 100,
      isOverloaded: this.estimatedCognitiveLoad >= 0.70
    };
  }

  // ===========================================================================
  // 6. LISTING'S LAW OF 3D OCULAR TORSION (Helmholtz, Tweed & Vilis)
  // ===========================================================================

  /**
   * Computes 3D ocular torsion angle (radians) according to Listing's Law.
   * Torsion theta_z = -0.5 * theta_x * theta_y
   */
  computeListings3DOrientation(gazeX = this.currentGaze.x, gazeY = this.currentGaze.y) {
    const thetaX = (gazeX - 0.5) * (45.0 * Math.PI / 180.0); // Horizontal angle (rad)
    const thetaY = (gazeY - 0.5) * (30.0 * Math.PI / 180.0); // Vertical angle (rad)
    
    // Listing's Law half-angle constraint
    let torsionZ = -0.5 * thetaX * thetaY;
    if (Math.abs(torsionZ) < 1e-9) torsionZ = 0.0;

    // 3D rotation quaternion representation [q0, qx, qy, qz]
    const q0 = Math.cos(thetaX / 2) * Math.cos(thetaY / 2);
    const qx = Math.sin(thetaX / 2) * Math.cos(thetaY / 2);
    const qy = Math.cos(thetaX / 2) * Math.sin(thetaY / 2);
    const qz = Math.sin(torsionZ / 2);

    return {
      thetaXRad: Math.abs(thetaX) < 1e-9 ? 0.0 : Math.round(thetaX * 1000) / 1000,
      thetaYRad: Math.abs(thetaY) < 1e-9 ? 0.0 : Math.round(thetaY * 1000) / 1000,
      torsionZRad: Math.round(torsionZ * 10000) / 10000,
      quaternion: { q0: Math.round(q0 * 1000) / 1000, qx: Math.round(qx * 1000) / 1000, qy: Math.round(qy * 1000) / 1000, qz: Math.round(qz * 1000) / 1000 }
    };
  }

  // ===========================================================================
  // 7. VESTIBULO-OCULAR REFLEX (VOR) & HEAD-EYE GAZE DECOMPOSITION
  // ===========================================================================

  /**
   * Evaluates sub-10ms Vestibulo-Ocular Reflex counter-rotation.
   * Gaze G(t) = Eye(t) + Head(t)
   * dE_VOR / dt = -G_VOR * omega_head(t - tau)
   */
  applyVestibuloOcularReflex(headVelPitch = 0.0, headVelYaw = 0.0) {
    const G_VOR = 0.98; // Primate VOR gain ~0.98
    const vorCompensationX = -G_VOR * headVelYaw;
    const vorCompensationY = -G_VOR * headVelPitch;

    return {
      compensatedGazeVelocityX: Math.round(vorCompensationX * 100) / 100,
      compensatedGazeVelocityY: Math.round(vorCompensationY * 100) / 100,
      vorGain: G_VOR,
      latencyMs: 8 // Sub-10ms reflex latency
    };
  }

  // ===========================================================================
  // 8. SMOOTH PURSUIT & CATCH-UP SACCADE DYNAMICS (Lisberger et al.)
  // ===========================================================================

  /**
   * Computes smooth pursuit velocity tracking for dynamic objects (e.g. moving mouse cursor).
   * If retinal position error exceeds threshold, flags catch-up saccade trigger.
   */
  computeSmoothPursuit() {
    const targetVx = this.userCursor.vx || 0.0;
    const targetVy = this.userCursor.vy || 0.0;
    const targetSpeed = Math.sqrt(targetVx * targetVx + targetVy * targetVy);

    const G_V = 0.95; // Velocity gain
    const pursuitVx = G_V * targetVx;
    const pursuitVy = G_V * targetVy;

    // Retinal position slip error
    const posErrorX = (this.userCursor.x - this.currentGaze.x) * 45.0;
    const posErrorY = (this.userCursor.y - this.currentGaze.y) * 30.0;
    const posErrorDeg = Math.sqrt(posErrorX * posErrorX + posErrorY * posErrorY);

    const isCatchUpSaccadeNeeded = posErrorDeg > 2.5 && targetSpeed > 8.0;

    return {
      pursuitVelocity: { vx: Math.round(pursuitVx * 10) / 10, vy: Math.round(pursuitVy * 10) / 10 },
      targetSpeedDegS: Math.round(targetSpeed * 10) / 10,
      retinalPositionErrorDeg: Math.round(posErrorDeg * 10) / 10,
      isCatchUpSaccadeNeeded
    };
  }

  // ===========================================================================
  // 9. DYNAMIC VISUAL ACUITY (DVA) UNDER RETINAL SLIP VELOCITY
  // ===========================================================================

  /**
   * Computes degradation of visual acuity under retinal slip velocity (motion blur).
   * DVA(v_slip) = Acuity_static / (1 + (v_slip / v_0)^kappa)
   */
  computeDynamicVisualAcuity(retinalSlipDegS = 0.0) {
    const staticAcuity = 1.0;
    const v0 = 5.0; // deg/s corner velocity
    const kappa = 1.4;

    const dva = staticAcuity / (1.0 + Math.pow(Math.max(0, retinalSlipDegS) / v0, kappa));
    return Math.round(dva * 1000) / 1000;
  }

  // ===========================================================================
  // 10. BINOCULAR VERGENCE & STEREOSCOPIC DEPTH (Cumming & DeAngelis)
  // ===========================================================================

  /**
   * Computes binocular vergence angle theta_vergence = 2 * atan(IPD / (2 * Z))
   * for screen depth perception.
   */
  computeBinocularVergence(depthMm = this.viewingDistanceMm) {
    const depth = Math.max(100.0, depthMm);
    const vergenceAngleRad = 2.0 * Math.atan(this.interpupillaryDistMm / (2.0 * depth));
    const vergenceAngleDeg = vergenceAngleRad * (180.0 / Math.PI);

    return {
      vergenceAngleDeg: Math.round(vergenceAngleDeg * 100) / 100,
      vergenceAngleRad: Math.round(vergenceAngleRad * 10000) / 10000,
      depthMm: depth,
      disparityArcmin: Math.round((this.interpupillaryDistMm / depth) * 3437.75 * 10) / 10
    };
  }

  // ===========================================================================
  // 11. CONTRAST SENSITIVITY FUNCTION (CSF) & SPATIAL FREQUENCY (Campbell & Robson)
  // ===========================================================================

  /**
   * Contrast Sensitivity Function S(f) = a * f^c * exp(-b * f)
   * f in cycles/degree. Peak sensitivity at 3 - 5 cpd.
   */
  computeContrastSensitivity(spatialFreqCpd = 4.0) {
    const a = 75.0;
    const b = 0.22;
    const c = 1.42;
    const f = Math.max(0.1, Math.min(60.0, spatialFreqCpd));

    const csf = a * Math.pow(f, c) * Math.exp(-b * f);
    return Math.round(csf * 10) / 10;
  }

  // ===========================================================================
  // 12. MASTER GAZE TICK & STATE INTEGRATION
  // ===========================================================================

  /**
   * Advances the biological eye state by delta time dt (ms).
   * Executes saccades, pursuit, fixations, and pupillometry in closed-loop.
   */
  step(now = Date.now()) {
    const dt = Math.max(1, now - this.lastGazeUpdate);
    this.lastGazeUpdate = now;

    // 1. Evaluate Joint Attention target
    const { jointFocus, deicticAlignmentQuality } = this.evaluateJointAttention();
    this.targetGaze = jointFocus;

    // 2. Check if a new saccade or smooth pursuit is active
    const dx = this.targetGaze.x - this.currentGaze.x;
    const dy = this.targetGaze.y - this.currentGaze.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const pursuit = this.computeSmoothPursuit();

    if (!this.isSaccading && (dist > 0.05 || pursuit.isCatchUpSaccadeNeeded)) {
      const dynamics = this.computeSaccadeDynamics(this.currentGaze.x, this.currentGaze.y, this.targetGaze.x, this.targetGaze.y);
      this.isSaccading = true;
      this.saccadeStartTime = now;
      this.saccadeDuration = dynamics.durationMs;
      this.saccadicSuppression = dynamics.suppressionFactor;
    }

    if (this.isSaccading) {
      const elapsed = now - this.saccadeStartTime;
      const progress = Math.min(1.0, elapsed / Math.max(1, this.saccadeDuration));

      // Smooth Sigmoidal Saccade Velocity Profile
      const sCurve = 1.0 / (1.0 + Math.exp(-10.0 * (progress - 0.5)));
      this.currentGaze.x += dx * sCurve * (dt / this.saccadeDuration);
      this.currentGaze.y += dy * sCurve * (dt / this.saccadeDuration);

      if (progress >= 1.0) {
        this.isSaccading = false;
        this.saccadicSuppression = 0.0;
        this.currentGaze.x = this.targetGaze.x;
        this.currentGaze.y = this.targetGaze.y;
      }
    } else {
      // Fixational Micro-Movements during steady fixation
      const fixOffset = this.computeFixationalOffset(now);
      this.currentGaze.x = Math.max(0, Math.min(1, this.currentGaze.x + fixOffset.x));
      this.currentGaze.y = Math.max(0, Math.min(1, this.currentGaze.y + fixOffset.y));
    }

    // 3. Update Pupillometry
    const pupil = this.updatePupillometry(this.ambientLuminance, this.estimatedCognitiveLoad, this.bondingVibeFactor);

    // 4. Compute 3D Listing's Orientation & Vergence
    const listing3D = this.computeListings3DOrientation(this.currentGaze.x, this.currentGaze.y);
    const vergence = this.computeBinocularVergence();
    const dva = this.computeDynamicVisualAcuity(pursuit.retinalPositionErrorDeg);

    return {
      gaze: { x: Math.round(this.currentGaze.x * 1000) / 1000, y: Math.round(this.currentGaze.y * 1000) / 1000 },
      isSaccading: this.isSaccading,
      saccadicSuppression: this.saccadicSuppression,
      deicticAlignmentQuality,
      pupilDiameterMm: pupil.pupilDiameterMm,
      workloadIndex: pupil.workloadIndex,
      listing3D,
      vergence,
      dynamicVisualAcuity: dva,
      foveatedCrop: this.getFoveatedCropBox()
    };
  }

  /**
   * Activates biological human eye mode, locking dynamics into realistic
   * foveal attention, saccadic sequences, and fixational micro-movements.
   */
  activateHumanEyeMode(options = {}) {
    this.mode = 'human_biological';
    this.humanEyeActive = true;
    if (options.gaze) {
      this.currentGaze.x = typeof options.gaze.x === 'number' ? Math.max(0, Math.min(1, options.gaze.x)) : 0.5;
      this.currentGaze.y = typeof options.gaze.y === 'number' ? Math.max(0, Math.min(1, options.gaze.y)) : 0.5;
      this.targetGaze.x = this.currentGaze.x;
      this.targetGaze.y = this.currentGaze.y;
    }
    if (options.userCursor) {
      this.updateUserInputs(options.userCursor);
    }
    const state = this.step();
    return {
      active: true,
      mode: 'human_biological',
      gaze: state.gaze,
      fovealCrop: state.foveatedCrop,
      dynamicVisualAcuity: state.dynamicVisualAcuity,
      pupilDiameterMm: state.pupilDiameterMm,
      isSaccading: state.isSaccading,
      deicticAlignment: state.deicticAlignmentQuality
    };
  }

  /**
   * Formats a concise neural eye status for agent context injection.
   */
  getEyeContextString() {
    const state = this.step();
    return `[HumanEyeCortex] Gaze=(${state.gaze.x}, ${state.gaze.y}) | Saccading=${state.isSaccading} | DeicticAlignment=${state.deicticAlignmentQuality} | Pupil=${state.pupilDiameterMm}mm | Load=${state.workloadIndex} | 3D_Torsion=${state.listing3D.torsionZRad}rad | Vergence=${state.vergence.vergenceAngleDeg}°`;
  }
}

module.exports = new HumanEyeCortex();
module.exports.HumanEyeCortex = HumanEyeCortex;
