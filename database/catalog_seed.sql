-- Optional starter catalog for a FRESH database. Safe to rerun; no demo accounts/packages.
USE tourism_booking;
INSERT IGNORE INTO destinations (name) VALUES ('Chennai'), ('Ooty'), ('Madurai'), ('Kodaikanal'), ('Mahabalipuram');
INSERT IGNORE INTO categories (name) VALUES ('Nature'), ('Culture'), ('Adventure'), ('Heritage'), ('Wellness');
