// Tamara Cloudinary Dashboard mathi malele details ahiya muko
const CLOUD_NAME = "mxcgwtkv";       // Example: "dxy123abc"
const UPLOAD_PRESET = "Jamin_preset"; // Example: "jamin_preset"

/**
 * Image file ne Cloudinary par upload karine direct URL aape chhe
 * @param {File} file - User a select kareli image file
 * @returns {Promise<string>} Upload thai gayeli image nu secure URL
 */
export async function uploadImageToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      throw new Error("Failed to upload image to Cloudinary");
    }

    const data = await response.json();
    return data.secure_url; // Direct image URL (e.g. https://res.cloudinary.com/...)
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    throw error;
  }
}
