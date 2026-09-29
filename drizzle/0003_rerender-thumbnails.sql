-- Thumbnails stored before this migration drew DICOM overlays at half size; render them again.
UPDATE "instance" SET "thumbnail" = false;
