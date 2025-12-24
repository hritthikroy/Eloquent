// ===== Typing Animation =====
const typingText = document.getElementById('typingText');
const phrases = [
  "Hello, this is a demo of Eloquent's voice transcription...",
  "Just speak naturally and watch your words appear instantly.",
  "AI-powered accuracy with support for 50+ languages.",
  "Transform your voice into text, effortlessly."
];

let phraseIndex = 0;
let charIndex = 0;
let isDeleting = false;
let typingSpeed = 50;

function typeText() {
  const currentPhrase = phrases[phraseIndex];
  
  if (isDeleting) {
    typingText.textContent = currentPhrase.substring(0, charIndex - 1);
    charIndex--;
    typingSpeed = 30;
  } else {
    typingText.textContent = currentPhrase.substring(0, charIndex + 1);
    charIndex++;
    typingSpeed = 50;
  }

  if (!isDeleting && charIndex === currentPhrase.length) {
    isDeleting = true;
    typingSpeed = 2000; // Pause at end
  } else if (isDeleting && charIndex === 0) {
    isDeleting = false;
    phraseIndex = (phraseIndex + 1) % phrases.length;
    typingSpeed = 500; // Pause before next phrase
  }

  setTimeout(typeText, typingSpeed);
}

// Start typing animation
setTimeout(typeText, 1000);

// ===== Timer Animation =====
const timerElement = document.querySelector('.timer');
let seconds = 0;

setInterval(() => {
  seconds = (seconds + 1) % 60;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  timerElement.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
}, 1000);

// ===== Smooth Scroll =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// ===== Intersection Observer for Animations =====
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('animate-in');
    }
  });
}, observerOptions);

// Observe feature cards
document.querySelectorAll('.feature-card').forEach((card, index) => {
  card.style.opacity = '0';
  card.style.transform = 'translateY(30px)';
  card.style.transition = `all 0.6s ease ${index * 0.1}s`;
  observer.observe(card);
});

// Observe steps
document.querySelectorAll('.step').forEach((step, index) => {
  step.style.opacity = '0';
  step.style.transform = 'translateY(30px)';
  step.style.transition = `all 0.6s ease ${index * 0.2}s`;
  observer.observe(step);
});

// Observe download cards
document.querySelectorAll('.download-card').forEach((card, index) => {
  card.style.opacity = '0';
  card.style.transform = 'translateY(30px)';
  card.style.transition = `all 0.6s ease ${index * 0.15}s`;
  observer.observe(card);
});

// Add animate-in class styles
const style = document.createElement('style');
style.textContent = `
  .animate-in {
    opacity: 1 !important;
    transform: translateY(0) !important;
  }
`;
document.head.appendChild(style);

// ===== Navbar Background on Scroll =====
const navbar = document.querySelector('.navbar');
let lastScroll = 0;

window.addEventListener('scroll', () => {
  const currentScroll = window.pageYOffset;
  
  if (currentScroll > 100) {
    navbar.style.background = 'rgba(15, 23, 42, 0.95)';
    navbar.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
  } else {
    navbar.style.background = 'rgba(15, 23, 42, 0.8)';
    navbar.style.boxShadow = 'none';
  }
  
  lastScroll = currentScroll;
});

// ===== Parallax Effect for Orbs =====
document.addEventListener('mousemove', (e) => {
  const orbs = document.querySelectorAll('.orb');
  const x = e.clientX / window.innerWidth;
  const y = e.clientY / window.innerHeight;
  
  orbs.forEach((orb, index) => {
    const speed = (index + 1) * 20;
    const xOffset = (x - 0.5) * speed;
    const yOffset = (y - 0.5) * speed;
    orb.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
  });
});

// ===== Wave Animation Randomization =====
const waveBars = document.querySelectorAll('.wave-bar');
setInterval(() => {
  waveBars.forEach(bar => {
    const randomHeight = 20 + Math.random() * 80;
    bar.style.height = `${randomHeight}%`;
  });
}, 200);

console.log('🎤 Eloquent Website Loaded');
