import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "../config/firebase";

/**
 * Upload an image file to Firebase Storage and return the download URL
 */
export const uploadImage = async (
  file: File,
  path: string = "products",
): Promise<string> => {
  // Create a unique filename
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageRef = ref(storage, `${path}/${timestamp}_${safeName}`);

  // Upload the file
  const snapshot = await uploadBytes(storageRef, file, {
    contentType: file.type,
  });

  // Get and return the download URL
  const downloadURL = await getDownloadURL(snapshot.ref);
  return downloadURL;
};

/**
 * Upload multiple image files and return array of download URLs
 */
export const uploadImages = async (
  files: File[],
  path: string = "products",
): Promise<string[]> => {
  const uploadPromises = files.map((file) => uploadImage(file, path));
  return Promise.all(uploadPromises);
};

/**
 * Delete an image from Firebase Storage by its URL
 */
export const deleteImage = async (imageUrl: string): Promise<void> => {
  try {
    // Only delete if it's a Firebase Storage URL
    if (
      imageUrl.includes("firebasestorage.googleapis.com") ||
      imageUrl.includes("firebasestorage.app")
    ) {
      const imageRef = ref(storage, imageUrl);
      await deleteObject(imageRef);
    }
  } catch (error) {
    console.warn("Failed to delete image from storage:", error);
  }
};

/**
 * Check if a string is a base64 data URL (legacy format)
 */
export const isBase64Image = (url: string): boolean => {
  return url.startsWith("data:image/");
};
