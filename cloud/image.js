var Image = require("parse-image");

Parse.Cloud.beforeSave("Image", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // BeforeSave function to process an image after it's been uploaded to Parse.

    // Once the "Image" object has been created with a file in the "originalImage"
    // field, this function can be called to process the image and create a
    // medium-sized image and a thumbnail image.

    var imageObject = request.object;

    if (!imageObject.get("originalImage"))
    {
        response.error("Image objects must have a file in the \'originalImage\' field");
    }
    else if (imageObject.dirty("originalImage"))
    {   
        createThumbnail(imageObject).then(

            function(result)
            {    
                createMedium(imageObject).then(
            
                    function(result)
                    {
                        createMediumSquare(imageObject).then(

                            function(result)
                            {
                                response.success();
                            },
                            function(error)
                            {
                                response.error(error);
                            }
                        );
                    },
                    function(error)
                    {
                        response.error(error);
                    }
                );
            },
            function(error)
            {
                response.error(error);
            }
        );
    }
    else
        response.success();
});



Parse.Cloud.define("makeThumbnailImage", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // Creates a 128x128 thumbnail image from a Parse Image object with an image
    // file in the "origianlImage" field and puts it in the "thumbnailImage" field

    // params:
    //
    //      imageId - the objectId of the Parse Image object to be processed

    var ImageObject = Parse.Object.extend("Image");
    var query = new Parse.Query(ImageObject);

    query.get(request.params.imageId,
    {
        useMasterKey: true,
        success: function(imageObject)
        {
            createThumbnail(imageObject).then(

                function(result)
                {    
                    response.success();
                },
                function(error)
                {
                    response.error(error);
                }
            );
        },
        error: function(error)
        {
            response.error("Could not query image!");
        }
    });

});



Parse.Cloud.define("makeMediumImage", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    // Creates a 512x512 medium image from a Parse Image object with an image
    // file in the "origianlImage" field and puts it in the "mediumImage" field

    // params:
    //
    //      imageId - the objectId of the Parse Image object to be processed

    var ImageObject = Parse.Object.extend("Image");
    var query = new Parse.Query(ImageObject);

    query.get(request.params.imageId,
    {
        useMasterKey: true,
        success: function(imageObject)
        {
            createMedium(imageObject).then(

                function(result)
                {    
                    response.success();
                },
                function(error)
                {
                    response.error(error);
                }
            );
        },
        error: function(error)
        {
            response.error("Could not query image!");
        }
    });

});







// functions below to process images to different sizes.

// each returns a Parse.Promise



function createThumbnail(imageObject)
{
    // crop and resize "originalImage" to a 128x128 image and save
    // to "thumbnailImage" field.

    return Parse.Cloud.httpRequest({

        url: imageObject.get("originalImage").url()

    }).then(function(response) {

        var image = new Image();
        return image.setData(response.buffer);

    }).then(function(image) {

        // make image a square

        var size = Math.min(image.width(), image.height());
        return image.crop({
            left: (image.width() - size) / 2,
            top: (image.height() - size) / 2,
            width: size,
            height: size
        });

    }).then(function(image) {

        // resize to 128x128

        return image.scale({
            width: 128,
            height: 128
        });

    }).then(function(image) {

        // make jpeg

        return image.setFormat("JPEG");
    
    }).then(function(image) {

        // put data in a buffer

        return image.data();

    }).then(function(buffer) {

        // save to file

        var base64 = buffer.toString("base64");
        var thumbnail = new Parse.File("thumbnail.jpg", { base64: base64 });
        return thumbnail.save(null, { useMasterKey: true });

    }).then(function(thumbnail) {

        // Attach the image file to the original object.

        imageObject.set("thumbnailImage", thumbnail);

    });
}



function createMedium(imageObject)
{
    // resize "originalImage" so that the longest side is the defined size 

    var size = 640;

    return Parse.Cloud.httpRequest({

        url: imageObject.get("originalImage").url()

    }).then(function(response) {

        var image = new Image();
        return image.setData(response.buffer);

    }).then(function(image) {

        // resize to width or height of size, whichever is greater

        if (image.width() > image.height())
        {
            return image.scale({
                width: size,
                height: image.height() * (size/image.width())
            });
        }
        else
        {
            return image.scale({
                width: image.width() * (size/image.height()),
                height: size
            });
        }

    }).then(function(image) {

        // make jpeg

        return image.setFormat("JPEG");
    
    }).then(function(image) {

        // put data in a buffer

        return image.data();

    }).then(function(buffer) {

        // save to file

        var base64 = buffer.toString("base64");
        var medium = new Parse.File("medium.jpg", { base64: base64 });
        return medium.save(null, { useMasterKey: true });

    }).then(function(medium) {

        // Attach the image file to the original object.

        imageObject.set("mediumImage", medium);

    });
}


function createMediumSquare(imageObject)
{
    // make a square of the medium image

    return Parse.Cloud.httpRequest({

        url: imageObject.get("mediumImage").url()

    }).then(function(response) {

        var image = new Image();
        return image.setData(response.buffer);

    }).then(function(image) {

        // make image a square

        var size = Math.min(image.width(), image.height());
        return image.crop({
            left: (image.width() - size) / 2,
            top: (image.height() - size) / 2,
            width: size,
            height: size
        });

    }).then(function(image) {

        // make jpeg

        return image.setFormat("JPEG");
    
    }).then(function(image) {

        // put data in a buffer

        return image.data();

    }).then(function(buffer) {

        // save to file

        var base64 = buffer.toString("base64");
        var square = new Parse.File("square.jpg", { base64: base64 });
        return square.save(null, { useMasterKey: true });

    }).then(function(square) {

        // Attach the image file to the original object.

        imageObject.set("mediumSquareImage", square);

    });
}
