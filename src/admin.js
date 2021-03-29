"use strict";

// Loads database and all elements on page
const init = () => {
  // Load config to connect to firebase
  const firebaseConfig = {
    apiKey: "AIzaSyC7YDYaXNuS0Q3sTxJDi66vGGl5maDwMNQ",
    authDomain: "prism-capstone2-project.firebaseapp.com",
    databaseURL: "https://prism-capstone2-project-default-rtdb.firebaseio.com/",
    storageBucket: "prism-capstone2-project.appspot.com",
  };

  // Initialize app and connect to database
  firebase.initializeApp(firebaseConfig);
  const dbWishRef = firebase.database().ref('/wishes/');

  // Load wishes and display audit cards
  loadWishes(dbWishRef);
};

// Loads all wishes from the database which are not approved and generate approvals for each
const loadWishes = (dbRef) => {
  dbRef.on('child_added', (data) => {
    const wishObj = data.val();
    if(wishObj.approved || wishObj.approved === false) return;

    const approvalCard = `
      <div class="cards">
        <h3>Wish for</h3>
        <h2>${wishObj.wish}</h2>
        <button style="background-color: green;" class="approveButton" id=${data.key}>Approve</button>
        <button style="background-color: rgb(218, 25, 25);" class="rejectButton" id=${data.key}>Disapprove</button>
      </div>
    `;

    const html = $.parseHTML(approvalCard);
    $('.auditwishes').append(html);

    const approveButton = Array.prototype.slice.call(document.querySelectorAll('.approveButton')).pop();
    approveButton.addEventListener('click', (e) => auditWish(e.target.id, dbRef, true));
    const rejectButton = Array.prototype.slice.call(document.querySelectorAll('.rejectButton')).pop();
    rejectButton.addEventListener('click', (e) => auditWish(e.target.id, dbRef, false));
  }); 
};

// Approves or rejects specified wish with given status
const auditWish = (wishID, dbRef, approved) => {
  dbRef.child(wishID).update({approved});
  document.querySelector('.auditwishes').innerHTML = "";
  loadWishes(dbRef);
};

// Starts init function when page fully loads
window.onload = init;