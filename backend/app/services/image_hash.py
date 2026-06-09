import io

from PIL import Image


def calculate_dhash(image_bytes: bytes, hash_size: int = 8) -> str:
    """
    Computes the Difference Hash (dHash) of an image from bytes.
    dHash tracks gradients between adjacent pixels.
    Returns a 16-character hexadecimal string representing the 64-bit hash.
    """
    try:
        image = Image.open(io.BytesIO(image_bytes))
        # Convert to grayscale and resize to (hash_size + 1, hash_size)
        # Using Resampling.LANCZOS for smooth resizing
        image = image.convert("L").resize((hash_size + 1, hash_size), Image.Resampling.LANCZOS)

        # Get pixel values
        pixels = list(image.getdata())

        difference = []
        for row in range(hash_size):
            for col in range(hash_size):
                # Compare pixel at (col, row) with pixel at (col + 1, row)
                pixel_left = pixels[row * (hash_size + 1) + col]
                pixel_right = pixels[row * (hash_size + 1) + col + 1]
                difference.append(pixel_left > pixel_right)

        # Convert list of 64 booleans into a hex string
        decimal_value = 0
        hex_string = []
        for index, value in enumerate(difference):
            if value:
                decimal_value += 2 ** (index % 8)
            if (index % 8) == 7:
                # Convert byte to 2-digit hex and pad if necessary
                hex_string.append(hex(decimal_value)[2:].zfill(2))
                decimal_value = 0

        return "".join(hex_string)
    except Exception as e:
        print(f"Error calculating image dHash: {e}")
        # Return a dummy hash on error
        return "0000000000000000"

def calculate_hamming_distance(hash1: str, hash2: str) -> int:
    """
    Calculates the Hamming distance between two hex-encoded hash strings.
    A distance of 0 means identical images.
    A distance <= 10 (out of 64 bits) indicates high visual similarity (>84%).
    """
    if not hash1 or not hash2 or len(hash1) != len(hash2):
        return 999
    try:
        h1 = int(hash1, 16)
        h2 = int(hash2, 16)
        # XOR the two integers, count the set bits (1s)
        return bin(h1 ^ h2).count("1")
    except ValueError:
        return 999
