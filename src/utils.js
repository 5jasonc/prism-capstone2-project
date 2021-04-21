// UTILITY CONSTANTS
// { #F2387C, #F2387C, #DE41F2, #6C2EF2, #031473, #031059 }

export const vertexShader = ` 
    varying vec3 vPosition;

    void main() {
        vPosition = position;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float ps = 1.-distance(vPosition, vec3(0.));
        gl_PointSize = 10.*ps;
        gl_Position = projectionMatrix * mvPosition;
    }`;

export const fragmentShader = `
    uniform vec3 color;
    varying vec3 vPosition;

    void main() {
        vec2 uv = gl_PointCoord.xy;
        float dist = smoothstep(1.-distance(vec2(.5), uv), 0., .5);
        float alph = 1.-distance(vPosition, vec3(0.));
        float finalph = dist*alph*4.;
        if (finalph < .2) discard;
        vec3 color = vec3(1,1,1);
        gl_FragColor = vec4(color, finalph);
    }`;

export const firebaseConfig = {
    apiKey: "AIzaSyC7YDYaXNuS0Q3sTxJDi66vGGl5maDwMNQ",
    authDomain: "prism-capstone2-project.firebaseapp.com",
    databaseURL: "https://prism-capstone2-project-default-rtdb.firebaseio.com/",
    storageBucket: "prism-capstone2-project.appspot.com",
};

// CSS UTILITY FUNCTIONS //////////////////////////

// Change the css file that a link tag points to
export const changeStyleSource = (newFile) => {
    const linkToChange = document.querySelector('#styleChangeLink');
    linkToChange.href = newFile;
};

// Updates all neccessary elements as search term is changed
export const updateWishSearchText = (e, jellies) => {
    const wishResult = document.querySelector('#wishSearchResult');
    const wishBannerResults = document.querySelector('#wishBannerSearchResult');
    const searchtxt = e.target.value;
    document.getElementById('searchTxt').innerHTML = searchtxt;
    const jellyResults = jellies.filter(jelly => jelly.wish.includes(searchtxt));
    wishResult.innerHTML = jellyResults.length;
    wishBannerResults.innerHTML = jellyResults.length;
    document.getElementById('bannerBar').style.display = 'flex';
};

// Toggles display of search interface
export const toggleSearchUI = () => {
    const x = document.querySelector('#searchJelly');
    if(x.style.display !== 'block') x.style.display = 'block';
    else x.style.display = 'none';
};

// Hides search interface
export const hideSearchUI = () => {
    const x = document.querySelector('#searchJelly');
    if(x.style.display === 'block') x.style.display = 'none';
};

// Toggles temporary make wish UI
export const toggleTempWishUI = () => {
    const x = document.querySelector('#myDIV');
    if(x.style.display !== 'inline') x.style.display = 'inline';
    else x.style.display = 'none';
};

// Hides text that shows a jelly's wish
export const hideWishText = () => {
    const wishText = document.querySelector('#wishText');
    const wishBox = document.querySelector('#wishtxtbox');
    wishText.style.display = 'none';
    wishBox.style.display = 'none';
};

export const showGalleryPage = () => {
    $('#Exit').fadeIn();
    // $('#bannerBar').fadeIn();
    $('#wishtxtbox').fadeIn();
    $('#searchWindow').fadeIn();
    //$('.export').fadeIn();
    $('.controlscontainer').fadeIn();
    $('.addJellyFish').fadeIn();
    $('.amountofwish').fadeIn();
    $('.line').fadeIn();
    // $('.search').fadeIn();
    changeStyleSource('styles/index.css');
};

export const hideGalleryPage = () => {
    $('#Exit').fadeOut();
    $('#bannerBar').fadeOut();
    $('#wishtxtbox').fadeOut();
    $('#searchWindow').fadeOut();
    $('.export').fadeOut();
    $('.controlscontainer').fadeOut();
    $('.addJellyFish').fadeOut();
    $('.amountofwish').fadeOut();
    $('.line').fadeOut();
    $('.search').fadeOut();
};

export const showWelcomePage = () => {
    $('#welcomescreen').fadeIn();
    changeStyleSource('styles/welcome.css'); 
};

export const hideWelcomePage = () => {
    $('#welcomescreen').fadeOut();
};

// JS UTILITY FUNCTIONS //////////////////////////

// Gets stored userID, or if none exists, generates new one, stores in local storage, and returns new ID
export const getUserID = () => {
    let userID = localStorage.getItem('prism-wishful-user');
    if(!userID) {
        userID = `user-${Date.now()}-${Math.floor(Math.random() * 999)}`;
        localStorage.setItem('prism-wishful-user', userID);
    }
    return userID;
};

// Simple hash function
export const hashFunc = (s) => {
    for(var i = 0, h = 0xdeadbeef; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 2654435761);
    return ((h ^ h >>> 16) >>> 0).toString();
};

// Maps input number within specified range to matching output within specified range
export const mapNumToRange = (input, minInput, maxInput, minOutput, maxOutput) => {
    return (input - minInput) * (maxOutput - minOutput) / (maxInput - minInput) + minOutput;
};

// Get random number between min and max
export const randomNum = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1) + min);
};