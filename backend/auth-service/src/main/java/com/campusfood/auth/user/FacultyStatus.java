package com.campusfood.auth.user;

/** Faculty get their food delivered. A student account becomes faculty after the admin checks their college ID. */
public enum FacultyStatus {
    /** Normal student account (or never asked). */
    NONE,
    /** Said "I am faculty" but hasn't sent the ID yet – still treated as a student, reminded to verify. */
    NOT_VERIFIED,
    /** Sent a request with an ID photo; waiting for the admin. */
    PENDING,
    /** Checked by the admin: may order delivery. */
    APPROVED,
    /** Request turned down (see facultyNote), or faculty access removed. */
    REJECTED
}
