import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { FlowRouter } from 'meteor/kadira:flow-router';
// https://kadira.io/academy/meteor-routing-guide/content/subscriptions-and-data-management/with-blaze
// TODO: need to import Bert?
// TODO: need ot import $?

// Load template itself
import './filmReview.html';
// Load templates used inside this template
import '../components/filmPlayer.js';
import '../components/privateMessageForm.js';
import '../components/footer.js'; // TODO remove this once template-ized
import '../../api/filmManagement/users/users.js';
import '../../api/filmManagement/films/films.js';
import '../../api/filmManagement/privateMessages/privateMessages.js';
import '../../api/filmManagement/comments/comments.js';

Template.filmReview.onRendered(function() {
    let self = this;
    self.autorun(function() {
        self.subscribe('users.withFilms');
        self.subscribe('files.films.all');
        self.subscribe('privateMessages.all');
        // let postId = FlowRouter.current().params._id;
        self.subscribe( 'post', FlowRouter.getParam('userId') );
        self.subscribe( 'comments' );
    });
});

Template.filmReview.helpers({
    userData: function() {
        // get data:
        let userFilm = Users.findOne({ _id: FlowRouter.getParam('userId') });
        if (userFilm) {
            return userFilm;
        } else {
            return {};
        }
    },
    film: function() {
        // since we're calling the helper {{.. film}} within a {{#with userData}} helper block,
        // "this" is set to the value returned from {{userData}} namely, the result of Users.findOne(url param userId)
        // so, we can search the Films collection for that user's submitted film without consulting the User collection again
        if (this.submittedFilm) {
            return Films.collection.findOne({ _id: this.submittedFilm.fileId});
        } else {
            return {};
        }
    },
    titlecase: function(str) {
        if (str) {
            return str.toLowerCase().split(' ').map((word) => (word.charAt(0).toUpperCase() + word.slice(1))).join(' '); // FreeCodeCamp! This method from https://medium.freecodecamp.com/three-ways-to-title-case-a-sentence-in-javascript-676a9175eb27
        } else {
            return "";
        }
    },

    // Helpers for Private Messages
    numPrivateMessages: function() {
        if (Meteor.userId() && this._id) { // in the data context of a filmReview template, this is a User document for that filmmaker
            var rooms = PrivateMessages.findOne({ to: this._id, from: Meteor.userId() });
            if (rooms) {
                return rooms.messages.length;
            } else {
                // no previously created conversation found, return nothing
                return '';
            }
        } else {
            console.log("ERROR: No user logged in, so cannot show messages count");
            return '';
        }
    },
    notSelfUser: function() {
        // this helper, called with {{#if notSelfUser }}, will hide html content if this user is viewing their own Film page
        if (Meteor.userId() && this._id) { // in the data context of a filmReview template, this is a User document for that filmmaker
            if (Meteor.userId() !== this._id) {
                return true;
            } else {
                return false;
            }
        }
    },

    // helpers for Ratings
    hasReviewerChecked: function(thisRadioButtonScore) {
        const reviewerId = Meteor.userId();
        if (reviewerId) {
            if ('ratings' in this.submittedFilm) {
                const ratingsArray = this.submittedFilm.ratings;
                const filtered = ratingsArray.filter((item) => {
                    return item.reviewerId == reviewerId;
                });
                if (filtered.length === 1) {
                    return (filtered[0].rating == thisRadioButtonScore);
                }
            }
        }
        return false;
    },
    reviewScore: function() {
        if (this.submittedFilm) {
            if ('ratingScore' in this.submittedFilm) {
                const score = this.submittedFilm.ratingScore;
                if (score == 0) {
                    return "Neutral Rating";
                } else {
                    return score;
                }
            } else {
                return "No ratings yet";
            }
        }
        return "n/a"; // if the object is not available, provide graceful error message to user
    },
    reviewIcon: function() {
        if (this.submittedFilm) {
            if ('ratingScore' in this.submittedFilm) {
                let score = this.submittedFilm.ratingScore;
                if (score > 0) {
                    return 'glyphicon glyphicon-thumbs-up';
                } else if (score < 0) {
                    return 'glyphicon glyphicon-thumbs-down';
                } else { //score is zero
                    return '';
                }
            }
        }
        return '';
    },

    // helpers for Comments
    comments() {
        let comments = Comments.find({ postId: this._id},{ sort: { date: -1 }});
        if ( comments ) {
            return comments;
        }
    },
    formatTime: function(myTime) {
        // TODO: can formatTime be split off into a template on its own??
        const weekday = ['Sun', 'Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat'];
        const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const time = new Date(myTime);
        return weekday[time.getDay()] + ' ' + month[time.getMonth()] + ' ' + time.getDate() + ', ' + time.getFullYear() + ' ' + time.getHours() + ':' + (time.getMinutes() < 10 ? '0' : '') + time.getMinutes();
    },
});

Template.filmReview.events({
    // Ratings events:
    'change .ratingRadio': function(e) {
        // note: don't need to verify that e.target.checked is true, because Meteor's event handling code seems to only call the 'change' event for the positively selected one

        // add visual class to ratings radio when selected
        $('.list-group-item').removeClass('active');
        $(e.target.parentNode.parentNode).addClass('active');

        // update the db
        const filmmakerId = this._id;
        const reviewerId = Meteor.userId();
        const rating = e.target.value;
        Meteor.call('setRating', filmmakerId, reviewerId, rating, function(error, result) {
            if (error) {
                Bert.alert("Rating failed: " + error.reason, 'danger', 'growl-top-right');
            } else {
                Bert.alert("Your rating has been counted!", 'success', 'growl-top-right');
            }
        });
    },

    // Comments events:
    'submit #add-comment' ( event, template ) {
        event.preventDefault();

        let comment = {
            postId: this._id,
            author: template.find( "[name='author']" ).value,
            content: template.find( "[name='content']" ).value,
            date: new Date
        };

        Meteor.call( 'addComment', comment, ( error, response ) => {
            if ( error ) {
                Bert.alert( error.reason, "warning" );
            } else {
                Bert.alert( 'Your comment has been posted', 'success', 'growl-top-right');
                template.find( "[name='author']" ).value = '';
                template.find( "[name='content']" ).value = '';
            }
        });
    }
});
